
DROP VIEW IF EXISTS public.my_contributions_due;
DROP VIEW IF EXISTS public.group_defaulters;

-- 1) mark_defaulted_contributions
CREATE OR REPLACE FUNCTION public.mark_defaulted_contributions()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int := 0;
  v_today date := current_date;
  rec record;
  admin_rec record;
BEGIN
  FOR rec IN
    SELECT c.id, c.payer_user_id, c.group_id, c.turn_id, c.amount,
           t.due_date, t.turn_number, g.name AS group_name,
           (v_today - t.due_date) AS days_late
    FROM public.contributions c
    JOIN public.turns t ON t.id = c.turn_id
    JOIN public.groups g ON g.id = c.group_id
    WHERE c.status IN ('pending','submitted','rejected')
      AND t.due_date < v_today
      AND t.status IN ('upcoming','collecting')
  LOOP
    UPDATE public.contributions
      SET status = 'defaulted',
          defaulted_at = COALESCE(defaulted_at, now()),
          default_days = rec.days_late
      WHERE id = rec.id;

    INSERT INTO public.notifications (user_id, kind, title, body, group_id, turn_id, link)
    VALUES (rec.payer_user_id, 'contribution_defaulted',
      'Cotisation en défaut',
      rec.group_name || ' — tour #' || rec.turn_number || ' · ' || rec.days_late || ' j de retard. Régularisez sous 48h pour éviter une mise en demeure.',
      rec.group_id, rec.turn_id, '/cotisations');

    FOR admin_rec IN SELECT user_id FROM public.group_admin_permissions WHERE group_id = rec.group_id LOOP
      INSERT INTO public.notifications (user_id, kind, title, body, group_id, turn_id, link)
      VALUES (admin_rec.user_id, 'contribution_defaulted',
        'Membre en défaut',
        rec.group_name || ' — tour #' || rec.turn_number || ' · cotisation impayée depuis ' || rec.days_late || ' j.',
        rec.group_id, rec.turn_id, '/groupes/' || rec.group_id::text);
    END LOOP;

    INSERT INTO public.tontine_alerts (group_id, turn_id, contribution_id, severity, code, message, metadata)
    VALUES (rec.group_id, rec.turn_id, rec.id, 'high', 'CONTRIBUTION_DEFAULTED',
      'Cotisation en défaut depuis ' || rec.days_late || ' j',
      jsonb_build_object('payer_user_id', rec.payer_user_id, 'amount', rec.amount, 'days_late', rec.days_late));

    BEGIN PERFORM public.log_audit(rec.group_id, 'contribution_defaulted', 'contribution', rec.id,
      jsonb_build_object('payer_user_id', rec.payer_user_id, 'days_late', rec.days_late, 'amount', rec.amount));
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN PERFORM public.recompute_reliability(rec.payer_user_id);
    EXCEPTION WHEN OTHERS THEN NULL; END;

    v_count := v_count + 1;
  END LOOP;

  UPDATE public.contributions c SET default_days = (v_today - t.due_date)
    FROM public.turns t
    WHERE c.turn_id = t.id AND c.status = 'defaulted' AND (v_today - t.due_date) <> c.default_days;

  RETURN v_count;
END $$;
GRANT EXECUTE ON FUNCTION public.mark_defaulted_contributions() TO service_role;

-- 2) recompute_reliability étendu
CREATE OR REPLACE FUNCTION public.recompute_reliability(_user_id uuid DEFAULT auth.uid())
RETURNS public.user_reliability_scores
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total_due int; v_total_paid int; v_on_time int; v_late int;
  v_avg_delay numeric(6,2); v_cycles int;
  v_defaults_open int; v_legal_count int;
  v_payment_score int; v_score int; v_tier public.reliability_tier;
  v_pay_rate numeric; v_on_time_rate numeric; v_penalty int;
  v_avg_rating numeric(4,2); v_reviews_count int; v_social_score numeric;
  v_row public.user_reliability_scores%rowtype;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT COUNT(*) INTO v_total_due
    FROM public.contributions c JOIN public.turns t ON t.id = c.turn_id
    WHERE c.payer_user_id = _user_id
      AND (c.status IN ('confirmed','defaulted')
           OR (c.status IN ('pending','submitted','rejected') AND t.status IN ('upcoming','collecting','paid')));

  SELECT COUNT(*) INTO v_total_paid FROM public.contributions
    WHERE payer_user_id = _user_id AND status = 'confirmed';

  SELECT
    COUNT(*) FILTER (WHERE c.confirmed_at::date <= t.due_date),
    COUNT(*) FILTER (WHERE c.confirmed_at::date >  t.due_date),
    COALESCE(AVG(GREATEST(0, (c.confirmed_at::date - t.due_date))) FILTER (WHERE c.status='confirmed'), 0)
  INTO v_on_time, v_late, v_avg_delay
  FROM public.contributions c JOIN public.turns t ON t.id = c.turn_id
  WHERE c.payer_user_id = _user_id AND c.status = 'confirmed';

  SELECT COUNT(DISTINCT cy.id) INTO v_cycles
    FROM public.cycles cy JOIN public.turns t ON t.cycle_id = cy.id
    JOIN public.contributions c ON c.turn_id = t.id
    WHERE c.payer_user_id = _user_id AND c.status = 'confirmed' AND cy.ended_at IS NOT NULL;

  SELECT COUNT(*) INTO v_defaults_open FROM public.contributions
    WHERE payer_user_id = _user_id AND status = 'defaulted';

  SELECT COUNT(*) INTO v_legal_count FROM public.member_default_reports
    WHERE reported_user_id = _user_id AND status = 'legal_action';

  IF v_total_due = 0 THEN v_payment_score := 0;
  ELSE
    v_pay_rate := v_total_paid::numeric / NULLIF(v_total_due, 0);
    v_on_time_rate := CASE WHEN v_total_paid > 0 THEN v_on_time::numeric / v_total_paid ELSE 0 END;
    v_penalty := CASE WHEN v_avg_delay > 7 THEN 10 WHEN v_avg_delay > 3 THEN 5 ELSE 0 END;
    v_penalty := v_penalty + (v_defaults_open * 15);
    v_payment_score := GREATEST(0, LEAST(100, ROUND(85 * v_pay_rate + 15 * v_on_time_rate)::int - v_penalty));
  END IF;

  SELECT COALESCE(AVG(rating), 0)::numeric(4,2), COUNT(*)
    INTO v_avg_rating, v_reviews_count
    FROM public.member_reviews WHERE reviewed_user_id = _user_id;

  IF v_reviews_count >= 1 THEN
    v_social_score := (v_avg_rating / 5.0) * 100.0;
    v_score := ROUND(0.7 * v_payment_score + 0.3 * v_social_score)::int;
  ELSE v_score := v_payment_score; END IF;

  IF v_legal_count > 0 OR v_defaults_open >= 2 THEN v_tier := 'blocked';
  ELSIF v_total_due = 0 THEN v_tier := 'nouveau';
  ELSIF v_score >= 85 THEN v_tier := 'excellent';
  ELSIF v_score >= 70 THEN v_tier := 'bon';
  ELSIF v_score >= 50 THEN v_tier := 'moyen';
  ELSE v_tier := 'risque'; END IF;

  INSERT INTO public.user_reliability_scores (
    user_id, score, tier, total_due, total_paid, total_on_time, total_late,
    avg_delay_days, cycles_completed, last_computed_at, avg_rating, reviews_count
  ) VALUES (
    _user_id, v_score, v_tier, v_total_due, v_total_paid, v_on_time, v_late,
    v_avg_delay, v_cycles, now(), v_avg_rating, v_reviews_count
  )
  ON CONFLICT (user_id) DO UPDATE SET
    score = EXCLUDED.score, tier = EXCLUDED.tier,
    total_due = EXCLUDED.total_due, total_paid = EXCLUDED.total_paid,
    total_on_time = EXCLUDED.total_on_time, total_late = EXCLUDED.total_late,
    avg_delay_days = EXCLUDED.avg_delay_days, cycles_completed = EXCLUDED.cycles_completed,
    last_computed_at = EXCLUDED.last_computed_at,
    avg_rating = EXCLUDED.avg_rating, reviews_count = EXCLUDED.reviews_count
  RETURNING * INTO v_row;

  UPDATE public.profiles SET reliability_score = v_score WHERE id = _user_id;
  RETURN v_row;
END $$;
GRANT EXECUTE ON FUNCTION public.recompute_reliability(uuid) TO authenticated, service_role;

-- 3) Vue group_defaulters
CREATE VIEW public.group_defaulters
WITH (security_invoker = true) AS
SELECT c.id AS contribution_id, c.group_id, c.turn_id, c.payer_user_id,
  p.full_name AS payer_name, c.amount, c.defaulted_at, c.default_days,
  t.turn_number, t.due_date,
  EXISTS (
    SELECT 1 FROM public.member_default_reports r
    WHERE r.contribution_id = c.id AND r.status IN ('open','in_review','legal_action')
  ) AS has_open_report
FROM public.contributions c
JOIN public.turns t ON t.id = c.turn_id
LEFT JOIN public.profiles p ON p.id = c.payer_user_id
WHERE c.status = 'defaulted'
  AND EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = c.group_id AND gm.user_id = auth.uid()
  );
GRANT SELECT ON public.group_defaulters TO authenticated;

-- 4) Vue my_contributions_due recréée (inclut 'defaulted')
CREATE VIEW public.my_contributions_due
WITH (security_invoker = true) AS
SELECT c.id AS contribution_id, c.turn_id, c.group_id, g.name AS group_name,
  c.amount, c.status, t.turn_number, t.due_date, t.beneficiary_user_id,
  pb.full_name AS beneficiary_name,
  (t.due_date - current_date) AS days_to_due,
  c.default_days, c.defaulted_at,
  CASE WHEN g.late_penalty_percent > 0
         AND (current_date - t.due_date) > g.late_penalty_after_days
       THEN (c.amount * g.late_penalty_percent) / 100 ELSE 0 END AS expected_penalty
FROM public.contributions c
JOIN public.turns t ON t.id = c.turn_id
JOIN public.groups g ON g.id = c.group_id
LEFT JOIN public.profiles pb ON pb.id = t.beneficiary_user_id
WHERE c.payer_user_id = auth.uid()
  AND c.status IN ('pending','submitted','rejected','defaulted')
  AND t.status IN ('upcoming','collecting')
ORDER BY t.due_date ASC;
GRANT SELECT ON public.my_contributions_due TO authenticated;

-- 5) RPC report_defaulter
CREATE OR REPLACE FUNCTION public.report_defaulter(_contribution_id uuid, _reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_c public.contributions%rowtype; v_report_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_c FROM public.contributions WHERE id = _contribution_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTRIBUTION_NOT_FOUND'; END IF;
  IF v_c.status <> 'defaulted' THEN RAISE EXCEPTION 'CONTRIBUTION_NOT_DEFAULTED'; END IF;
  IF NOT public.has_admin_permission(v_c.group_id, v_uid, 'can_report_defaulter') THEN
    RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF EXISTS (SELECT 1 FROM public.member_default_reports
             WHERE contribution_id = _contribution_id AND status IN ('open','in_review','legal_action'))
  THEN RAISE EXCEPTION 'REPORT_ALREADY_OPEN'; END IF;

  INSERT INTO public.member_default_reports (group_id, reported_user_id, reported_by, contribution_id, reason, status)
  VALUES (v_c.group_id, v_c.payer_user_id, v_uid, _contribution_id, _reason, 'open')
  RETURNING id INTO v_report_id;

  INSERT INTO public.tontine_alerts (group_id, turn_id, contribution_id, severity, code, message, metadata)
  VALUES (v_c.group_id, v_c.turn_id, v_c.id, 'critical', 'DEFAULTER_REPORTED',
    'Signalement officiel à Tontine',
    jsonb_build_object('report_id', v_report_id, 'reported_user_id', v_c.payer_user_id, 'reason', _reason));

  INSERT INTO public.notifications (user_id, kind, title, body, group_id, link)
  VALUES (v_c.payer_user_id, 'defaulter_reported', 'Votre compte a été signalé',
    'Votre cotisation impayée a été signalée à l''équipe Tontine. Régularisez immédiatement pour éviter toute procédure.',
    v_c.group_id, '/cotisations');

  PERFORM public.log_audit(v_c.group_id, 'defaulter_reported', 'contribution', _contribution_id,
    jsonb_build_object('report_id', v_report_id, 'reason', _reason));
  RETURN v_report_id;
END $$;
GRANT EXECUTE ON FUNCTION public.report_defaulter(uuid, text) TO authenticated;

-- 6) RPC update_defaulter_report (super-admin)
CREATE OR REPLACE FUNCTION public.update_defaulter_report(
  _report_id uuid, _status text DEFAULT NULL,
  _internal_notes text DEFAULT NULL, _resolution_note text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_r public.member_default_reports%rowtype;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_r FROM public.member_default_reports WHERE id = _report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_NOT_FOUND'; END IF;

  UPDATE public.member_default_reports SET
    status = COALESCE(_status, status),
    internal_notes = COALESCE(_internal_notes, internal_notes),
    resolution_note = COALESCE(_resolution_note, resolution_note),
    tontine_handler_id = v_uid,
    resolved_at = CASE WHEN _status IN ('resolved','dismissed','legal_action') THEN now() ELSE resolved_at END
  WHERE id = _report_id;

  IF _status IN ('resolved','dismissed','legal_action') THEN
    INSERT INTO public.notifications (user_id, kind, title, body, group_id)
    VALUES
      (v_r.reported_user_id, 'defaulter_report_resolved', 'Signalement mis à jour',
       'Statut : ' || _status || COALESCE(' — ' || _resolution_note, ''), v_r.group_id),
      (v_r.reported_by, 'defaulter_report_resolved', 'Signalement traité',
       'L''équipe Tontine a traité votre signalement. Statut : ' || _status, v_r.group_id);
  END IF;

  PERFORM public.log_audit(v_r.group_id, 'defaulter_report_updated', 'default_report', _report_id,
    jsonb_build_object('status', _status, 'handler', v_uid));

  IF _status = 'legal_action' THEN PERFORM public.recompute_reliability(v_r.reported_user_id); END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.update_defaulter_report(uuid, text, text, text) TO authenticated;

-- 7) record_mock_payment : accepte 'defaulted' + clôt signalements + recalc score
CREATE OR REPLACE FUNCTION public.record_mock_payment(
  _contribution_id uuid, _provider public.payment_provider DEFAULT 'simulation'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_contrib public.contributions%rowtype;
  v_turn public.turns%rowtype;
  v_group public.groups%rowtype;
  v_payment_id uuid; v_remaining int;
  v_penalty bigint := 0; v_total bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_contrib FROM public.contributions WHERE id = _contribution_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTRIBUTION_NOT_FOUND'; END IF;
  IF v_contrib.payer_user_id <> v_user THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF v_contrib.status = 'confirmed' THEN RAISE EXCEPTION 'ALREADY_PAID'; END IF;

  SELECT * INTO v_turn  FROM public.turns  WHERE id = v_contrib.turn_id;
  SELECT * INTO v_group FROM public.groups WHERE id = v_contrib.group_id;

  IF v_group.late_penalty_percent > 0
     AND (current_date - v_turn.due_date) > v_group.late_penalty_after_days THEN
    v_penalty := (v_contrib.amount * v_group.late_penalty_percent) / 100;
  END IF;
  v_total := v_contrib.amount + v_penalty;

  INSERT INTO public.payments (contribution_id, group_id, user_id, amount, provider,
    provider_ref, status, initiated_at, settled_at)
  VALUES (v_contrib.id, v_contrib.group_id, v_user, v_total, _provider,
    'MOCK-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
    'succeeded', now(), now())
  RETURNING id INTO v_payment_id;

  UPDATE public.contributions SET
    status = 'confirmed', provider = _provider,
    reference = (SELECT provider_ref FROM public.payments WHERE id = v_payment_id),
    penalty_amount = v_penalty,
    submitted_at = now(), confirmed_at = now(), confirmed_by = v_user,
    defaulted_at = NULL, default_days = 0
  WHERE id = v_contrib.id;

  PERFORM public.append_ledger(v_contrib.group_id, v_turn.cycle_id, v_turn.id, v_contrib.id, v_payment_id,
    v_user, 'contribution_in', v_contrib.amount, 'Cotisation tour #' || v_turn.turn_number);

  IF v_penalty > 0 THEN
    PERFORM public.append_ledger(v_contrib.group_id, v_turn.cycle_id, v_turn.id, v_contrib.id, v_payment_id,
      v_user, 'penalty', v_penalty, 'Pénalité de retard (' || v_group.late_penalty_percent || '%)');
  END IF;

  UPDATE public.member_default_reports
    SET status = 'resolved',
        resolution_note = COALESCE(resolution_note, 'Régularisé par paiement du membre.'),
        resolved_at = now()
    WHERE contribution_id = v_contrib.id AND status IN ('open','in_review');

  SELECT COUNT(*) INTO v_remaining FROM public.contributions
    WHERE turn_id = v_turn.id AND status <> 'confirmed';

  IF v_remaining = 0 AND v_turn.status <> 'paid' THEN
    UPDATE public.turns SET status = 'collecting' WHERE id = v_turn.id AND status <> 'paid';
    INSERT INTO public.notifications (user_id, kind, title, body, group_id)
    VALUES (v_turn.beneficiary_user_id, 'contribution_received', 'Cagnotte complète',
      'Toutes les cotisations de votre tour ont été reçues. Versement à venir.', v_turn.group_id);
  END IF;

  PERFORM public.recompute_reliability(v_user);
  RETURN v_payment_id;
END $$;
GRANT EXECUTE ON FUNCTION public.record_mock_payment(uuid, public.payment_provider) TO authenticated;

-- 8) Cron quotidien
DO $$ DECLARE v_jobid int; BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'tontine_mark_defaulters';
    IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
    PERFORM cron.schedule('tontine_mark_defaulters', '0 6 * * *',
      $cron$ SELECT public.mark_defaulted_contributions(); $cron$);
  END IF;
END $$;
