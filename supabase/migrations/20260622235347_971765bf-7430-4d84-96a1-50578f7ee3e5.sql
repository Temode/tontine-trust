-- =====================================================================
-- 47 : Solde bénéficiaire + auto-clôture tours + correction start_cycle
-- =====================================================================

-- 1) Fix start_cycle : inclure le bénéficiaire dans les cotisations
CREATE OR REPLACE FUNCTION public.start_cycle(_group_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_group public.groups%ROWTYPE;
  v_count int;
  v_cycle_id uuid;
  v_cycle_number int;
  v_freq_days int;
  v_payout bigint;
  v_due date;
  r RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = _group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'GROUP_NOT_FOUND'; END IF;
  IF NOT public.is_group_organizer(_group_id, v_user) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF v_group.status NOT IN ('draft','open') THEN
    RAISE EXCEPTION 'CYCLE_ALREADY_STARTED';
  END IF;

  SELECT count(*) INTO v_count FROM public.group_members
    WHERE group_id = _group_id AND status = 'active';
  IF v_count < 2 THEN RAISE EXCEPTION 'QUORUM_NOT_REACHED'; END IF;

  IF v_group.rotation_order_kind = 'random' THEN
    WITH shuffled AS (
      SELECT id, row_number() OVER (ORDER BY random()) AS rn
      FROM public.group_members
      WHERE group_id = _group_id AND status = 'active'
    )
    UPDATE public.group_members gm SET position = s.rn
    FROM shuffled s WHERE gm.id = s.id;
  ELSE
    WITH ordered AS (
      SELECT id, row_number() OVER (
        ORDER BY position NULLS LAST, joined_at
      ) AS rn
      FROM public.group_members
      WHERE group_id = _group_id AND status = 'active'
    )
    UPDATE public.group_members gm SET position = o.rn
    FROM ordered o WHERE gm.id = o.id;
  END IF;

  SELECT coalesce(max(cycle_number), 0) + 1 INTO v_cycle_number
    FROM public.cycles WHERE group_id = _group_id;

  INSERT INTO public.cycles (group_id, cycle_number, started_at)
  VALUES (_group_id, v_cycle_number, now())
  RETURNING id INTO v_cycle_id;

  v_freq_days := public.frequency_to_days(v_group.frequency);
  IF v_freq_days IS NULL THEN v_freq_days := 7; END IF;

  v_payout := v_group.contribution_amount * v_count;
  v_due := current_date + v_freq_days;

  FOR r IN
    SELECT user_id, position
    FROM public.group_members
    WHERE group_id = _group_id AND status = 'active'
    ORDER BY position
  LOOP
    INSERT INTO public.turns (
      cycle_id, group_id, beneficiary_user_id,
      turn_number, due_date, payout_amount, status
    ) VALUES (
      v_cycle_id, _group_id, r.user_id,
      r.position, v_due, v_payout,
      (CASE WHEN r.position = 1 THEN 'collecting' ELSE 'upcoming' END)::public.turn_status
    );

    IF r.position = 1 THEN
      INSERT INTO public.contributions (
        turn_id, group_id, payer_user_id, amount, status
      )
      SELECT
        (SELECT id FROM public.turns
           WHERE cycle_id = v_cycle_id AND turn_number = 1),
        _group_id, gm.user_id, v_group.contribution_amount,
        'pending'::public.contribution_status
      FROM public.group_members gm
      WHERE gm.group_id = _group_id
        AND gm.status = 'active';
    END IF;

    v_due := v_due + v_freq_days;
  END LOOP;

  PERFORM set_config('app.via_rpc', '1', TRUE);
  UPDATE public.groups SET status = 'active' WHERE id = _group_id;

  INSERT INTO public.notifications (user_id, kind, title, body, group_id)
  SELECT gm.user_id, 'cycle_started'::public.notification_kind,
    'Cycle démarré',
    'L''ordre de rotation a été tiré. Premier tour ouvert à la collecte.',
    _group_id
  FROM public.group_members gm
  WHERE gm.group_id = _group_id AND gm.status = 'active';

  RETURN v_cycle_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.start_cycle(uuid) TO authenticated;

-- 2) Backfill cotisations manquantes pour bénéficiaires
INSERT INTO public.contributions (turn_id, group_id, payer_user_id, amount, status)
SELECT t.id, t.group_id, t.beneficiary_user_id,
       g.contribution_amount, 'pending'::public.contribution_status
FROM public.turns t
JOIN public.groups g ON g.id = t.group_id
WHERE t.status IN ('upcoming','collecting')
  AND NOT EXISTS (
    SELECT 1 FROM public.contributions c
    WHERE c.turn_id = t.id AND c.payer_user_id = t.beneficiary_user_id
  )
  AND EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = t.group_id
      AND gm.user_id = t.beneficiary_user_id
      AND gm.status = 'active'
  );

-- 3) Table beneficiary_balances
CREATE TABLE IF NOT EXISTS public.beneficiary_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  available_amount bigint NOT NULL DEFAULT 0 CHECK (available_amount >= 0),
  total_credited bigint NOT NULL DEFAULT 0 CHECK (total_credited >= 0),
  total_withdrawn bigint NOT NULL DEFAULT 0 CHECK (total_withdrawn >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id)
);

GRANT SELECT ON public.beneficiary_balances TO authenticated;
GRANT ALL ON public.beneficiary_balances TO service_role;

ALTER TABLE public.beneficiary_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS balances_select_self ON public.beneficiary_balances;
CREATE POLICY balances_select_self ON public.beneficiary_balances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_group_organizer(group_id, auth.uid()));

-- 4) Table withdrawal_requests
DO $$ BEGIN
  CREATE TYPE public.withdrawal_status AS ENUM ('pending','processing','paid','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.withdrawal_method AS ENUM ('OM','MOMO','CARD','BANK','CASH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  amount bigint NOT NULL CHECK (amount > 0),
  method public.withdrawal_method NOT NULL,
  destination text,
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  djomy_payout_ref text,
  notes text,
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS withdrawal_requests_user_idx ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS withdrawal_requests_group_idx ON public.withdrawal_requests(group_id);

GRANT SELECT, INSERT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS withdrawal_select ON public.withdrawal_requests;
CREATE POLICY withdrawal_select ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_group_organizer(group_id, auth.uid()));

DROP POLICY IF EXISTS withdrawal_insert_self ON public.withdrawal_requests;
CREATE POLICY withdrawal_insert_self ON public.withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 5) auto_close_turn
CREATE OR REPLACE FUNCTION public.auto_close_turn(_turn_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_turn public.turns%ROWTYPE;
  v_remaining int;
  v_total bigint;
  v_next_turn_id uuid;
  v_freq_days int;
  v_freq public.group_frequency;
  v_contrib_amount bigint;
BEGIN
  SELECT * INTO v_turn FROM public.turns WHERE id = _turn_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_turn.status <> 'collecting' THEN RETURN false; END IF;

  SELECT count(*) INTO v_remaining
  FROM public.contributions
  WHERE turn_id = v_turn.id AND status <> 'confirmed';
  IF v_remaining > 0 THEN RETURN false; END IF;

  SELECT coalesce(sum(amount),0) INTO v_total
  FROM public.contributions
  WHERE turn_id = v_turn.id AND status = 'confirmed';

  UPDATE public.turns
    SET status = 'paid', paid_at = now()
    WHERE id = v_turn.id;

  INSERT INTO public.beneficiary_balances (user_id, group_id, available_amount, total_credited)
  VALUES (v_turn.beneficiary_user_id, v_turn.group_id, v_total, v_total)
  ON CONFLICT (user_id, group_id) DO UPDATE
    SET available_amount = public.beneficiary_balances.available_amount + EXCLUDED.available_amount,
        total_credited = public.beneficiary_balances.total_credited + EXCLUDED.total_credited,
        updated_at = now();

  INSERT INTO public.audit_log (actor_user_id, group_id, action, entity_type, entity_id, metadata)
  VALUES (NULL, v_turn.group_id, 'turn_auto_closed', 'turn', v_turn.id,
    jsonb_build_object('turn_number', v_turn.turn_number,
                       'beneficiary_user_id', v_turn.beneficiary_user_id,
                       'amount_credited', v_total));

  INSERT INTO public.notifications (user_id, kind, title, body, group_id)
  SELECT gm.user_id, 'payout_released'::public.notification_kind,
    'Tour ' || v_turn.turn_number || ' clôturé',
    'Le bénéficiaire a été crédité de ' || v_total || ' GNF sur son solde.',
    v_turn.group_id
  FROM public.group_members gm
  WHERE gm.group_id = v_turn.group_id AND gm.status = 'active';

  SELECT id INTO v_next_turn_id
  FROM public.turns
  WHERE cycle_id = v_turn.cycle_id
    AND turn_number = v_turn.turn_number + 1
  FOR UPDATE;

  IF v_next_turn_id IS NOT NULL THEN
    SELECT frequency, contribution_amount INTO v_freq, v_contrib_amount
    FROM public.groups WHERE id = v_turn.group_id;
    v_freq_days := public.frequency_to_days(v_freq);
    IF v_freq_days IS NULL THEN v_freq_days := 7; END IF;

    UPDATE public.turns
      SET status = 'collecting',
          due_date = current_date + v_freq_days
      WHERE id = v_next_turn_id;

    INSERT INTO public.contributions (turn_id, group_id, payer_user_id, amount, status)
    SELECT v_next_turn_id, v_turn.group_id, gm.user_id,
           v_contrib_amount, 'pending'::public.contribution_status
    FROM public.group_members gm
    WHERE gm.group_id = v_turn.group_id AND gm.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.contributions c
        WHERE c.turn_id = v_next_turn_id AND c.payer_user_id = gm.user_id
      );

    INSERT INTO public.audit_log (actor_user_id, group_id, action, entity_type, entity_id, metadata)
    VALUES (NULL, v_turn.group_id, 'turn_auto_opened', 'turn', v_next_turn_id,
      jsonb_build_object('turn_number', v_turn.turn_number + 1));
  ELSE
    UPDATE public.cycles SET ended_at = now()
      WHERE id = v_turn.cycle_id AND ended_at IS NULL;
  END IF;

  RETURN true;
END; $$;

GRANT EXECUTE ON FUNCTION public.auto_close_turn(uuid) TO authenticated, service_role;

-- 6) Trigger contributions
CREATE OR REPLACE FUNCTION public.trg_contribution_auto_close()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    PERFORM public.auto_close_turn(NEW.turn_id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS contributions_auto_close ON public.contributions;
CREATE TRIGGER contributions_auto_close
  AFTER UPDATE OF status ON public.contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_contribution_auto_close();

-- 7) request_withdrawal
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _group_id uuid,
  _amount bigint,
  _method public.withdrawal_method,
  _destination text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance bigint;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  SELECT available_amount INTO v_balance
  FROM public.beneficiary_balances
  WHERE user_id = v_user AND group_id = _group_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < _amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  UPDATE public.beneficiary_balances
    SET available_amount = available_amount - _amount,
        total_withdrawn = total_withdrawn + _amount,
        updated_at = now()
    WHERE user_id = v_user AND group_id = _group_id;

  INSERT INTO public.withdrawal_requests (user_id, group_id, amount, method, destination, status)
  VALUES (v_user, _group_id, _amount, _method, _destination, 'pending')
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_user_id, group_id, action, entity_type, entity_id, metadata)
  VALUES (v_user, _group_id, 'withdrawal_requested', 'withdrawal_request', v_id,
    jsonb_build_object('amount', _amount, 'method', _method));

  RETURN v_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.request_withdrawal(uuid, bigint, public.withdrawal_method, text) TO authenticated;

-- 8) Vue my_balances
CREATE OR REPLACE VIEW public.my_balances
WITH (security_invoker = true) AS
SELECT
  b.id,
  b.user_id,
  b.group_id,
  g.name AS group_name,
  b.available_amount,
  b.total_credited,
  b.total_withdrawn,
  b.updated_at
FROM public.beneficiary_balances b
JOIN public.groups g ON g.id = b.group_id
WHERE b.user_id = auth.uid();

GRANT SELECT ON public.my_balances TO authenticated;

-- 9) Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.turns;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.contributions;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.beneficiary_balances;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

-- 10) Backfill auto-clôture sur tours déjà collecting
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.turns WHERE status = 'collecting' LOOP
    PERFORM public.auto_close_turn(r.id);
  END LOOP;
END $$;