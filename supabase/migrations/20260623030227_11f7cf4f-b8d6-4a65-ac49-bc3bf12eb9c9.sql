-- ============================================================
-- Chantier 4 — Pénalité de rétention majorée (backend)
-- ============================================================

-- 1) payout_hold_config : délais standard par fréquence (labels FR de l'enum)
CREATE TABLE IF NOT EXISTS public.payout_hold_config (
  frequency public.group_frequency PRIMARY KEY,
  standard_days int NOT NULL DEFAULT 7,
  penalty_extra_days int NOT NULL DEFAULT 7
);

GRANT SELECT ON public.payout_hold_config TO authenticated;
GRANT ALL ON public.payout_hold_config TO service_role;

ALTER TABLE public.payout_hold_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hold config readable by all" ON public.payout_hold_config;
CREATE POLICY "Hold config readable by all"
  ON public.payout_hold_config FOR SELECT TO authenticated
  USING (true);

-- Seed initial (idempotent) — valeurs françaises de l'enum group_frequency
INSERT INTO public.payout_hold_config (frequency, standard_days, penalty_extra_days)
VALUES
  ('quotidienne', 0, 7),
  ('hebdomadaire', 7, 7),
  ('quinzaine', 7, 7),
  ('mensuelle', 7, 7)
ON CONFLICT (frequency) DO NOTHING;

-- 2) Nouvelles colonnes sur group_members
ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS was_late_in_cycle boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS was_late_at_turn_number int[] DEFAULT NULL;

-- 3) Nouvelle colonne sur turns
ALTER TABLE public.turns
  ADD COLUMN IF NOT EXISTS payout_hold_until timestamptz DEFAULT NULL;

-- 4) compute_hold_until : calcule la date de libération
CREATE OR REPLACE FUNCTION public.compute_hold_until(_turn_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_turn public.turns%ROWTYPE;
  v_group public.groups%ROWTYPE;
  v_beneficiary public.group_members%ROWTYPE;
  v_config public.payout_hold_config%ROWTYPE;
  v_base timestamptz;
  v_result timestamptz;
BEGIN
  SELECT * INTO v_turn FROM public.turns WHERE id = _turn_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'TURN_NOT_FOUND'; END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = v_turn.group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'GROUP_NOT_FOUND'; END IF;

  SELECT * INTO v_config
    FROM public.payout_hold_config WHERE frequency = v_group.frequency;
  IF NOT FOUND THEN
    v_config.standard_days := 7;
    v_config.penalty_extra_days := 7;
  END IF;

  v_base := coalesce(v_turn.paid_at, now()) + (v_config.standard_days || ' days')::interval;

  SELECT * INTO v_beneficiary
    FROM public.group_members
    WHERE group_id = v_turn.group_id
      AND user_id = v_turn.beneficiary_user_id
      AND status = 'active';

  IF FOUND AND v_beneficiary.was_late_in_cycle THEN
    v_result := v_base + (v_config.penalty_extra_days || ' days')::interval;
  ELSE
    v_result := v_base;
  END IF;

  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION public.compute_hold_until(uuid) TO authenticated;

-- 5) Modifier auto_close_turn pour calculer payout_hold_until
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
  v_hold_until timestamptz;
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

  v_hold_until := public.compute_hold_until(v_turn.id);

  UPDATE public.turns
    SET status = 'paid', paid_at = now(), payout_hold_until = v_hold_until
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
                       'amount_credited', v_total,
                       'payout_hold_until', v_hold_until));

  INSERT INTO public.notifications (user_id, kind, title, body, group_id)
  SELECT gm.user_id, 'payout_released'::public.notification_kind,
    'Tour ' || v_turn.turn_number || ' clôturé',
    'Le bénéficiaire a été crédité de ' || v_total || ' GNF sur son solde.',
    v_turn.group_id
  FROM public.group_members gm
  WHERE gm.group_id = v_turn.group_id AND gm.status = 'active';

  IF v_hold_until > (coalesce(v_turn.paid_at, now()) + interval '7 days') THEN
    INSERT INTO public.notifications (user_id, kind, title, body, group_id)
    VALUES (v_turn.beneficiary_user_id, 'payout_hold_extended'::public.notification_kind,
      'Libération de votre payout repoussée',
      'Suite à un retard de cotisation ce cycle, vos fonds seront disponibles le ' ||
        to_char(v_hold_until, 'DD/MM/YYYY') || '.',
      v_turn.group_id);
  END IF;

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
END $$;

-- 6) Modifier start_cycle pour reset was_late_in_cycle
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
  v_contract record;
  v_unsigned int;
  r RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_group FROM public.groups WHERE id = _group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'GROUP_NOT_FOUND'; END IF;
  IF NOT public.is_group_organizer(_group_id, v_user) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF v_group.status NOT IN ('draft','open') THEN RAISE EXCEPTION 'CYCLE_ALREADY_STARTED'; END IF;

  SELECT count(*) INTO v_count FROM public.group_members
    WHERE group_id = _group_id AND status = 'active';
  IF v_count < 2 THEN RAISE EXCEPTION 'QUORUM_NOT_REACHED'; END IF;

  SELECT * INTO v_contract FROM public.get_active_contract(_group_id);
  IF v_contract.contract_id IS NULL THEN RAISE EXCEPTION 'CONTRACT_NOT_FOUND'; END IF;
  SELECT COUNT(*) INTO v_unsigned
  FROM public.group_members gm
  WHERE gm.group_id = _group_id AND gm.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.contract_signatures cs
      WHERE cs.contract_id = v_contract.contract_id AND cs.user_id = gm.user_id
    );
  IF v_unsigned > 0 THEN RAISE EXCEPTION 'CONTRACT_NOT_SIGNED'; END IF;

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

  UPDATE public.group_members
    SET was_late_in_cycle = false,
        was_late_at_turn_number = NULL
    WHERE group_id = _group_id AND status = 'active';

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
    SELECT user_id, position FROM public.group_members
    WHERE group_id = _group_id AND status = 'active'
    ORDER BY position
  LOOP
    INSERT INTO public.turns (
      cycle_id, group_id, beneficiary_user_id,
      turn_number, due_date, payout_amount, status
    ) VALUES (
      v_cycle_id, _group_id, r.user_id, r.position, v_due, v_payout,
      (CASE WHEN r.position = 1 THEN 'collecting' ELSE 'upcoming' END)::public.turn_status
    );
    IF r.position = 1 THEN
      INSERT INTO public.contributions (
        turn_id, group_id, payer_user_id, amount, status
      )
      SELECT
        (SELECT id FROM public.turns WHERE cycle_id = v_cycle_id AND turn_number = 1),
        _group_id, gm.user_id, v_group.contribution_amount, 'pending'::public.contribution_status
      FROM public.group_members gm
      WHERE gm.group_id = _group_id AND gm.status = 'active' AND gm.user_id <> r.user_id;
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
END $$;

-- 7) Modifier enqueue_payment_reminders pour marquer was_late_in_cycle dès J+1
CREATE OR REPLACE FUNCTION public.enqueue_payment_reminders()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_inserted int := 0;
  v_today date := current_date;
  rec record;
  v_diff int;
  v_existing int;
  v_turn_num int;
begin
  for rec in
    select * from public.pending_reminders_view where bucket is not null
  loop
    v_diff := rec.due_date - v_today;

    if exists (
      select 1 from public.reminder_log
      where contribution_id = rec.contribution_id
        and sent_on = v_today
        and bucket = rec.bucket
    ) then continue; end if;

    insert into public.notifications (user_id, kind, title, body, group_id, turn_id, link, data)
    values (
      rec.payer_user_id,
      'contribution_due'::public.notification_kind,
      case when v_diff >= 0 then 'Rappel cotisation' else 'Cotisation en retard' end,
      coalesce(rec.group_name,'Groupe') || ' — tour #' || rec.turn_number ||
        case
          when v_diff > 0 then ' · échéance dans ' || v_diff || ' j'
          when v_diff = 0 then ' · échéance aujourd''hui'
          else ' · ' || abs(v_diff) || ' j de retard' ||
               case when rec.expected_penalty > 0
                    then ' · pénalité ' || rec.expected_penalty || ' GNF'
                    else '' end
        end,
      rec.group_id, rec.turn_id, '/cotisations',
      jsonb_build_object(
        'bucket', rec.bucket,
        'amount', rec.amount,
        'expected_penalty', rec.expected_penalty,
        'days_late', rec.days_late,
        'late_penalty_percent', rec.late_penalty_percent
      )
    );

    insert into public.reminder_log (contribution_id, sent_on, bucket)
    values (rec.contribution_id, v_today, rec.bucket);

    IF rec.bucket = 'J+1' THEN
      SELECT turn_number INTO v_turn_num FROM public.turns WHERE id = rec.turn_id;
      UPDATE public.group_members
         SET was_late_in_cycle = true,
             was_late_at_turn_number = CASE
               WHEN was_late_at_turn_number IS NULL THEN ARRAY[v_turn_num]
               WHEN v_turn_num = ANY(was_late_at_turn_number) THEN was_late_at_turn_number
               ELSE array_append(was_late_at_turn_number, v_turn_num)
             END
       WHERE group_id = rec.group_id
         AND user_id = rec.payer_user_id
         AND status = 'active'::public.member_status;
    END IF;

    if rec.bucket = 'J+7' then
      select count(*) into v_existing from public.member_default_reports
        where contribution_id = rec.contribution_id;
      if v_existing = 0 then
        insert into public.member_default_reports (
          group_id, reported_user_id, reported_by, contribution_id, reason, status
        ) values (
          rec.group_id, rec.payer_user_id, rec.payer_user_id, rec.contribution_id,
          'Signalement automatique : cotisation impayée depuis ' || rec.days_late || ' jours.',
          'auto_flagged'
        );
        insert into public.notifications (user_id, kind, title, body, group_id, data)
        select gm.user_id, 'defaulter_reported'::public.notification_kind,
               'Membre en défaut détecté',
               'Un membre est en retard depuis ' || rec.days_late || ' jours sur le tour #' || rec.turn_number || '.',
               rec.group_id,
               jsonb_build_object('contribution_id', rec.contribution_id, 'auto', true)
        from public.group_members gm
        where gm.group_id = rec.group_id
          and gm.status = 'active'::public.member_status
          and gm.role in ('organizer'::public.member_role, 'co_organizer'::public.member_role);
      end if;
    end if;

    if rec.bucket = 'J+14' then
      update public.group_members
         set status = 'suspended'::public.member_status,
             suspended_at = coalesce(suspended_at, now()),
             suspended_reason = 'late_payment'
       where group_id = rec.group_id
         and user_id = rec.payer_user_id
         and status = 'active'::public.member_status;

      insert into public.notifications (user_id, kind, title, body, group_id, data)
      values (rec.payer_user_id, 'member_suspended'::public.notification_kind,
        'Droits suspendus',
        'Vos droits (vote, enchères) sont suspendus suite à 14 jours de retard sur le tour #' || rec.turn_number || '. Réglez la cotisation pour réactiver votre compte.',
        rec.group_id,
        jsonb_build_object('contribution_id', rec.contribution_id, 'auto', true));
    end if;

    v_inserted := v_inserted + 1;
  end loop;
  return v_inserted;
end $$;

-- 8) Modifier request_withdrawal pour ajouter garde-fou payout_hold_until
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _group_id uuid,
  _amount bigint,
  _method withdrawal_method,
  _destination text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance bigint;
  v_id uuid;
  v_dep_status text;
  v_dep_required boolean;
  v_locked_turn record;
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
  ORDER BY t.payout_hold_until DESC
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'PAYOUT_LOCKED_UNTIL:%', v_locked_turn.payout_hold_until;
  END IF;

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
END $$;