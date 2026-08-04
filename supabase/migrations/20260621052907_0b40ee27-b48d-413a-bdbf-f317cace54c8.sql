
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'dispute_raised';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'dispute_resolved';

CREATE TABLE IF NOT EXISTS public.contribution_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid NOT NULL REFERENCES public.contributions(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  raised_by uuid NOT NULL,
  reason text NOT NULL,
  evidence_url text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','under_review','accepted','rejected','resolved')),
  organizer_response text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.contribution_disputes TO authenticated;
GRANT ALL ON public.contribution_disputes TO service_role;

ALTER TABLE public.contribution_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their own disputes"
  ON public.contribution_disputes FOR SELECT TO authenticated
  USING (raised_by = auth.uid()
         OR public.has_admin_permission(group_id, auth.uid(), 'can_report_defaulter')
         OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members create their own disputes"
  ON public.contribution_disputes FOR INSERT TO authenticated
  WITH CHECK (raised_by = auth.uid());

CREATE POLICY "Organizers update disputes in their group"
  ON public.contribution_disputes FOR UPDATE TO authenticated
  USING (public.has_admin_permission(group_id, auth.uid(), 'can_report_defaulter')
         OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_admin_permission(group_id, auth.uid(), 'can_report_defaulter')
         OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_disputes_contribution ON public.contribution_disputes(contribution_id);
CREATE INDEX IF NOT EXISTS idx_disputes_group_status ON public.contribution_disputes(group_id, status);
CREATE INDEX IF NOT EXISTS idx_disputes_raised_by ON public.contribution_disputes(raised_by);

CREATE TRIGGER tg_contribution_disputes_updated_at
  BEFORE UPDATE ON public.contribution_disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.raise_contribution_dispute(
  _contribution_id uuid,
  _reason text,
  _evidence_url text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_c public.contributions%rowtype;
  v_id uuid;
  admin_rec record;
  v_group_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN RAISE EXCEPTION 'REASON_TOO_SHORT'; END IF;

  SELECT * INTO v_c FROM public.contributions WHERE id = _contribution_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTRIBUTION_NOT_FOUND'; END IF;
  IF v_c.payer_user_id <> v_uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  IF EXISTS (SELECT 1 FROM public.contribution_disputes
             WHERE contribution_id = _contribution_id
               AND status IN ('open','under_review'))
  THEN RAISE EXCEPTION 'DISPUTE_ALREADY_OPEN'; END IF;

  INSERT INTO public.contribution_disputes(contribution_id, group_id, raised_by, reason, evidence_url)
  VALUES (_contribution_id, v_c.group_id, v_uid, _reason, _evidence_url)
  RETURNING id INTO v_id;

  SELECT name INTO v_group_name FROM public.groups WHERE id = v_c.group_id;

  FOR admin_rec IN
    SELECT user_id FROM public.group_admin_permissions
    WHERE group_id = v_c.group_id AND can_report_defaulter = true
    UNION
    SELECT created_by AS user_id FROM public.groups WHERE id = v_c.group_id
  LOOP
    INSERT INTO public.notifications(user_id, kind, title, body, group_id, turn_id, link)
    VALUES (admin_rec.user_id, 'dispute_raised', 'Contestation reçue',
            COALESCE(v_group_name, 'Tontine') || ' — un membre conteste une cotisation en défaut.',
            v_c.group_id, v_c.turn_id, '/groupes/' || v_c.group_id::text);
  END LOOP;

  PERFORM public.log_audit(v_c.group_id, 'dispute_raised', 'contribution', _contribution_id,
    jsonb_build_object('dispute_id', v_id, 'reason', _reason));

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.raise_contribution_dispute(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_contribution_dispute(
  _dispute_id uuid,
  _status text,
  _response text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_d public.contribution_disputes%rowtype;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _status NOT IN ('under_review','accepted','rejected','resolved') THEN
    RAISE EXCEPTION 'INVALID_STATUS'; END IF;

  SELECT * INTO v_d FROM public.contribution_disputes WHERE id = _dispute_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'DISPUTE_NOT_FOUND'; END IF;

  IF NOT (public.has_admin_permission(v_d.group_id, v_uid, 'can_report_defaulter')
          OR public.has_role(v_uid, 'admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.contribution_disputes SET
    status = _status,
    organizer_response = COALESCE(_response, organizer_response),
    resolved_by = CASE WHEN _status IN ('accepted','rejected','resolved') THEN v_uid ELSE resolved_by END,
    resolved_at = CASE WHEN _status IN ('accepted','rejected','resolved') THEN now() ELSE resolved_at END
  WHERE id = _dispute_id;

  INSERT INTO public.notifications(user_id, kind, title, body, group_id, link)
  VALUES (v_d.raised_by, 'dispute_resolved', 'Réponse à votre contestation',
          'Statut : ' || _status || COALESCE(' — ' || _response, ''),
          v_d.group_id, '/cotisations');

  PERFORM public.log_audit(v_d.group_id, 'dispute_' || _status, 'contribution', v_d.contribution_id,
    jsonb_build_object('dispute_id', _dispute_id, 'response', _response, 'by', v_uid));
END $$;

GRANT EXECUTE ON FUNCTION public.resolve_contribution_dispute(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_defaulter_report(
  _report_id uuid,
  _status text DEFAULT NULL,
  _internal_notes text DEFAULT NULL,
  _resolution_note text DEFAULT NULL,
  _note_only boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_r public.member_default_reports%rowtype;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_r FROM public.member_default_reports WHERE id = _report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_NOT_FOUND'; END IF;

  IF _note_only THEN
    UPDATE public.member_default_reports SET
      internal_notes = COALESCE(_internal_notes, internal_notes),
      tontine_handler_id = v_uid
    WHERE id = _report_id;
    PERFORM public.log_audit(v_r.group_id, 'defaulter_note_added', 'default_report', _report_id,
      jsonb_build_object('note', _internal_notes, 'by', v_uid));
    RETURN;
  END IF;

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
    jsonb_build_object('status', _status, 'handler', v_uid,
                       'has_note', _internal_notes IS NOT NULL,
                       'has_resolution', _resolution_note IS NOT NULL));

  IF _status = 'legal_action' THEN PERFORM public.recompute_reliability(v_r.reported_user_id); END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.update_defaulter_report(uuid, text, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_default_report_audit(_report_id uuid)
RETURNS TABLE(
  id uuid, action text, actor_user_id uuid,
  actor_name text, actor_role text,
  metadata jsonb, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_r public.member_default_reports%rowtype;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_r FROM public.member_default_reports WHERE id = _report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_NOT_FOUND'; END IF;
  IF NOT (public.has_role(v_uid, 'admin')
          OR public.has_admin_permission(v_r.group_id, v_uid, 'can_report_defaulter')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  SELECT a.id, a.action, a.actor_user_id,
         p.full_name,
         COALESCE((SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = a.actor_user_id LIMIT 1), 'member'),
         a.metadata, a.created_at
  FROM public.audit_log a
  LEFT JOIN public.profiles p ON p.id = a.actor_user_id
  WHERE (a.entity_type = 'default_report' AND a.entity_id = _report_id)
     OR (a.entity_type = 'contribution' AND a.entity_id = v_r.contribution_id
         AND a.action IN ('contribution_defaulted','defaulter_reported','dispute_raised',
                          'dispute_resolved','dispute_accepted','dispute_rejected',
                          'dispute_under_review'))
  ORDER BY a.created_at ASC;
END $$;

GRANT EXECUTE ON FUNCTION public.get_default_report_audit(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_default_history(_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  contribution_id uuid, group_id uuid, group_name text,
  turn_number int, due_date date, amount bigint,
  status public.contribution_status,
  defaulted_at timestamptz, default_days int,
  paid_at timestamptz, notifications_count int,
  report_status text, dispute_status text, penalty_amount bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _user_id <> v_uid AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  SELECT c.id, c.group_id, g.name, t.turn_number, t.due_date, c.amount, c.status,
         c.defaulted_at, c.default_days, c.confirmed_at,
         (SELECT count(*)::int FROM public.notifications n
          WHERE n.user_id = c.payer_user_id
            AND (n.turn_id = c.turn_id OR (n.data->>'contribution_id') = c.id::text)
            AND n.kind IN ('contribution_due','contribution_defaulted','defaulter_reported','manual_reminder')),
         (SELECT r.status FROM public.member_default_reports r
          WHERE r.contribution_id = c.id ORDER BY r.created_at DESC LIMIT 1),
         (SELECT d.status FROM public.contribution_disputes d
          WHERE d.contribution_id = c.id ORDER BY d.created_at DESC LIMIT 1),
         c.penalty_amount
  FROM public.contributions c
  JOIN public.turns t ON t.id = c.turn_id
  JOIN public.groups g ON g.id = c.group_id
  WHERE c.payer_user_id = _user_id
    AND (c.defaulted_at IS NOT NULL OR c.status = 'defaulted')
  ORDER BY c.defaulted_at DESC NULLS LAST, t.due_date DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.get_user_default_history(uuid) TO authenticated;

DROP VIEW IF EXISTS public.my_contributions_due;
CREATE VIEW public.my_contributions_due AS
SELECT c.id AS contribution_id,
    c.turn_id, c.group_id, g.name AS group_name, c.amount, c.status,
    t.turn_number, t.due_date, t.beneficiary_user_id,
    pb.full_name AS beneficiary_name,
    t.due_date - CURRENT_DATE AS days_to_due,
    c.default_days, c.defaulted_at,
    g.late_penalty_percent,
    g.late_penalty_after_days,
    CASE
      WHEN g.late_penalty_percent > 0 AND (CURRENT_DATE - t.due_date) > g.late_penalty_after_days
      THEN c.amount * g.late_penalty_percent / 100
      ELSE 0::bigint
    END AS expected_penalty
FROM public.contributions c
JOIN public.turns t ON t.id = c.turn_id
JOIN public.groups g ON g.id = c.group_id
LEFT JOIN public.profiles pb ON pb.id = t.beneficiary_user_id
WHERE c.payer_user_id = auth.uid()
  AND c.status IN ('pending','submitted','rejected','defaulted')
  AND t.status IN ('upcoming','collecting')
ORDER BY t.due_date;

GRANT SELECT ON public.my_contributions_due TO authenticated;

CREATE OR REPLACE FUNCTION public.list_group_disputes(_group_id uuid)
RETURNS TABLE(
  id uuid, contribution_id uuid, raised_by uuid, raised_by_name text,
  reason text, evidence_url text, status text, organizer_response text,
  amount bigint, turn_number int, due_date date,
  created_at timestamptz, resolved_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT (public.has_admin_permission(_group_id, v_uid, 'can_report_defaulter')
          OR public.has_role(v_uid, 'admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
  SELECT d.id, d.contribution_id, d.raised_by, p.full_name,
         d.reason, d.evidence_url, d.status, d.organizer_response,
         c.amount, t.turn_number, t.due_date,
         d.created_at, d.resolved_at
  FROM public.contribution_disputes d
  JOIN public.contributions c ON c.id = d.contribution_id
  JOIN public.turns t ON t.id = c.turn_id
  LEFT JOIN public.profiles p ON p.id = d.raised_by
  WHERE d.group_id = _group_id
  ORDER BY d.created_at DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.list_group_disputes(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_defaulted_contributions()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_today date := current_date;
  rec record;
  admin_rec record;
  v_total_open int;
  v_top jsonb;
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

    INSERT INTO public.notifications (user_id, kind, title, body, group_id, turn_id, link, data)
    VALUES (rec.payer_user_id, 'contribution_defaulted',
      'Cotisation en défaut',
      rec.group_name || ' — tour #' || rec.turn_number || ' · ' || rec.days_late || ' j de retard. Régularisez sous 48h pour éviter une mise en demeure.',
      rec.group_id, rec.turn_id, '/cotisations',
      jsonb_build_object('contribution_id', rec.id, 'group_id', rec.group_id, 'days_late', rec.days_late));

    FOR admin_rec IN SELECT user_id FROM public.group_admin_permissions WHERE group_id = rec.group_id LOOP
      INSERT INTO public.notifications (user_id, kind, title, body, group_id, turn_id, link, data)
      VALUES (admin_rec.user_id, 'contribution_defaulted',
        'Membre en défaut',
        rec.group_name || ' — tour #' || rec.turn_number || ' · cotisation impayée depuis ' || rec.days_late || ' j.',
        rec.group_id, rec.turn_id, '/groupes/' || rec.group_id::text,
        jsonb_build_object('contribution_id', rec.id, 'group_id', rec.group_id, 'days_late', rec.days_late));
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

  IF v_count > 0 THEN
    SELECT count(*) INTO v_total_open FROM public.contributions WHERE status = 'defaulted';
    SELECT jsonb_agg(row_to_json(r)) INTO v_top FROM (
      SELECT g.name AS group_name, count(*) AS defaults
      FROM public.contributions c JOIN public.groups g ON g.id = c.group_id
      WHERE c.status = 'defaulted'
      GROUP BY g.name ORDER BY count(*) DESC LIMIT 5
    ) r;

    INSERT INTO public.tontine_alerts(group_id, severity, code, message, metadata)
    VALUES (NULL, 'high', 'DEFAULTER_DIGEST',
      v_count || ' nouvelles cotisations en défaut aujourd''hui (total ouvert : ' || v_total_open || ')',
      jsonb_build_object('new_today', v_count, 'total_open', v_total_open, 'top_groups', v_top,
                         'link', '/admin/defaillants'));
  END IF;

  RETURN v_count;
END $$;
