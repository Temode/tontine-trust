-- 1) Colonne anti-double-prélèvement sur contributions
ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS penalty_collected_at timestamptz;

-- 2) Table de solde de caisse par groupe
CREATE TABLE IF NOT EXISTS public.group_treasury (
  group_id   uuid PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  balance    bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.group_treasury TO authenticated;
GRANT ALL ON public.group_treasury TO service_role;
ALTER TABLE public.group_treasury ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read treasury" ON public.group_treasury;
CREATE POLICY "members read treasury" ON public.group_treasury
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_treasury.group_id
      AND gm.user_id = auth.uid()
  ));

-- 3) Historique des mouvements
CREATE TABLE IF NOT EXISTS public.group_treasury_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  amount          bigint NOT NULL,
  source          text NOT NULL CHECK (source IN ('late_penalty','manual_credit','manual_debit')),
  contribution_id uuid REFERENCES public.contributions(id) ON DELETE SET NULL,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_treasury_entries_group ON public.group_treasury_entries(group_id, created_at DESC);
GRANT SELECT ON public.group_treasury_entries TO authenticated;
GRANT ALL ON public.group_treasury_entries TO service_role;
ALTER TABLE public.group_treasury_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read treasury entries" ON public.group_treasury_entries;
CREATE POLICY "members read treasury entries" ON public.group_treasury_entries
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_treasury_entries.group_id
      AND gm.user_id = auth.uid()
  ));

-- 4) RPC: pénalité due par un user sur un groupe
CREATE OR REPLACE FUNCTION public.get_pending_penalty(_group_id uuid)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(penalty_amount), 0)::bigint
  FROM public.contributions
  WHERE group_id = _group_id
    AND payer_user_id = auth.uid()
    AND status = 'confirmed'
    AND penalty_amount > 0
    AND penalty_waived_at IS NULL
    AND penalty_collected_at IS NULL;
$$;
GRANT EXECUTE ON FUNCTION public.get_pending_penalty(uuid) TO authenticated;

-- 5) request_withdrawal v2 — prélève les pénalités et alimente la caisse
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _group_id uuid, _amount bigint, _method withdrawal_method, _destination text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance bigint;
  v_id uuid;
  v_dep_status text;
  v_dep_required boolean;
  v_locked_turn record;
  v_penalty_due bigint := 0;
  v_total_debit bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  SELECT g.deposit_required, gm.deposit_status
    INTO v_dep_required, v_dep_status
  FROM public.group_members gm
  JOIN public.groups g ON g.id = gm.group_id
  WHERE gm.group_id = _group_id AND gm.user_id = v_user;

  IF v_dep_required AND v_dep_status IS NOT NULL
     AND v_dep_status NOT IN ('paid','refunded','not_required') THEN
    RAISE EXCEPTION 'DEPOSIT_REQUIRED';
  END IF;

  SELECT t.id, t.payout_hold_until INTO v_locked_turn
  FROM public.turns t
  WHERE t.group_id = _group_id
    AND t.beneficiary_user_id = v_user
    AND t.status = 'paid'
    AND t.payout_hold_until IS NOT NULL
    AND t.payout_hold_until > now()
  ORDER BY t.payout_hold_until DESC LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'PAYOUT_LOCKED_UNTIL:%', v_locked_turn.payout_hold_until;
  END IF;

  SELECT COALESCE(SUM(penalty_amount), 0)::bigint INTO v_penalty_due
  FROM public.contributions
  WHERE group_id = _group_id AND payer_user_id = v_user
    AND status = 'confirmed' AND penalty_amount > 0
    AND penalty_waived_at IS NULL AND penalty_collected_at IS NULL;

  v_total_debit := _amount + v_penalty_due;

  SELECT available_amount INTO v_balance
  FROM public.beneficiary_balances
  WHERE user_id = v_user AND group_id = _group_id FOR UPDATE;

  IF v_balance IS NULL OR v_balance < v_total_debit THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  UPDATE public.beneficiary_balances
    SET available_amount = available_amount - v_total_debit,
        total_withdrawn = total_withdrawn + _amount,
        updated_at = now()
    WHERE user_id = v_user AND group_id = _group_id;

  -- Caisse du groupe + traçabilité par contribution
  IF v_penalty_due > 0 THEN
    INSERT INTO public.group_treasury (group_id, balance, updated_at)
    VALUES (_group_id, v_penalty_due, now())
    ON CONFLICT (group_id) DO UPDATE
      SET balance = group_treasury.balance + EXCLUDED.balance,
          updated_at = now();

    INSERT INTO public.group_treasury_entries
      (group_id, amount, source, contribution_id, user_id, note)
    SELECT _group_id, penalty_amount, 'late_penalty', id, v_user,
           'Prélèvement automatique au retrait'
    FROM public.contributions
    WHERE group_id = _group_id AND payer_user_id = v_user
      AND status = 'confirmed' AND penalty_amount > 0
      AND penalty_waived_at IS NULL AND penalty_collected_at IS NULL;

    UPDATE public.contributions
      SET penalty_collected_at = now()
      WHERE group_id = _group_id AND payer_user_id = v_user
        AND status = 'confirmed' AND penalty_amount > 0
        AND penalty_waived_at IS NULL AND penalty_collected_at IS NULL;
  END IF;

  INSERT INTO public.withdrawal_requests (user_id, group_id, amount, method, destination, status)
  VALUES (v_user, _group_id, _amount, _method, _destination, 'pending')
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_user_id, group_id, action, entity_type, entity_id, metadata)
  VALUES (v_user, _group_id, 'withdrawal_requested', 'withdrawal_request', v_id,
    jsonb_build_object('amount', _amount, 'method', _method, 'penalty_collected', v_penalty_due));

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(uuid,bigint,withdrawal_method,text) TO authenticated;