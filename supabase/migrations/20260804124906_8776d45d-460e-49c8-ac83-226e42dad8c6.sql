
ALTER TABLE public.cycles
  ADD COLUMN IF NOT EXISTS renewal_min_members int,
  ADD COLUMN IF NOT EXISTS renewal_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_threshold_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_expiry_notified_at timestamptz;

-- Les membres du groupe doivent pouvoir lire les votes du cycle en cours de renouvellement
DROP POLICY IF EXISTS "renewal vote group members read" ON public.cycle_renewal_votes;
CREATE POLICY "renewal vote group members read" ON public.cycle_renewal_votes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cycles c
    WHERE c.id = cycle_renewal_votes.cycle_id
      AND public.is_group_member(c.group_id, auth.uid())
  ));

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cycle_renewal_votes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cycles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ---------------------------------------------------------------
-- Ouverture d'une demande de relance
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.open_cycle_renewal(
  _group_id uuid, _min_members int, _deadline timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cycle public.cycles%ROWTYPE;
  v_active int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_group_organizer(_group_id, v_uid) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT * INTO v_cycle FROM public.cycles
   WHERE group_id = _group_id ORDER BY cycle_number DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_CYCLE'; END IF;

  IF EXISTS (SELECT 1 FROM public.turns t
             WHERE t.cycle_id = v_cycle.id AND t.status <> 'paid' AND t.status <> 'skipped') THEN
    RAISE EXCEPTION 'CYCLE_NOT_FINISHED';
  END IF;
  IF v_cycle.awaiting_renewal AND v_cycle.renewal_closed_at IS NULL THEN
    RAISE EXCEPTION 'RENEWAL_ALREADY_OPEN';
  END IF;

  SELECT count(*) INTO v_active FROM public.group_members
   WHERE group_id = _group_id AND status = 'active';
  IF _min_members < 2 THEN RAISE EXCEPTION 'MIN_MEMBERS_TOO_LOW'; END IF;
  IF _min_members > v_active THEN RAISE EXCEPTION 'MIN_MEMBERS_TOO_HIGH'; END IF;
  IF _deadline <= now() THEN RAISE EXCEPTION 'DEADLINE_IN_PAST'; END IF;

  DELETE FROM public.cycle_renewal_votes WHERE cycle_id = v_cycle.id;

  UPDATE public.cycles
     SET awaiting_renewal = true,
         renewal_min_members = _min_members,
         renewal_deadline = _deadline,
         renewal_opened_at = now(),
         renewal_closed_at = NULL,
         renewal_threshold_notified_at = NULL,
         renewal_expiry_notified_at = NULL
   WHERE id = v_cycle.id;

  -- l'organisateur est confirmé d'office (il initie la relance)
  INSERT INTO public.cycle_renewal_votes (cycle_id, user_id, agreed, voted_at)
  VALUES (v_cycle.id, v_uid, true, now())
  ON CONFLICT (cycle_id, user_id) DO UPDATE SET agreed = true, voted_at = now();

  PERFORM public.dispatch_notification(
    gm.user_id, 'system'::public.notification_kind,
    'Nouveau cycle proposé',
    'L''organisateur propose de relancer la tontine. Confirmez votre participation avant le '
      || to_char(_deadline, 'DD/MM/YYYY') || '.',
    jsonb_build_object('group_id', _group_id, 'cycle_id', v_cycle.id),
    _group_id,
    '/group/' || _group_id
  )
  FROM public.group_members gm
  WHERE gm.group_id = _group_id AND gm.status = 'active' AND gm.user_id <> v_uid;

  BEGIN
    PERFORM public.enqueue_generic_sms(
      'renewal_open',
      ARRAY(SELECT gm.user_id FROM public.group_members gm
            WHERE gm.group_id = _group_id AND gm.status = 'active' AND gm.user_id <> v_uid),
      'Tontine Digitale : un nouveau cycle est proposé. Confirmez votre participation avant le '
        || to_char(_deadline, 'DD/MM/YYYY') || '.',
      _group_id, NULL
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_cycle.id;
END $$;

REVOKE ALL ON FUNCTION public.open_cycle_renewal(uuid, int, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.open_cycle_renewal(uuid, int, timestamptz) TO authenticated;

-- ---------------------------------------------------------------
-- Vote d'un membre
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vote_cycle_renewal(_cycle_id uuid, _agreed boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cycle public.cycles%ROWTYPE;
  v_org uuid;
  v_accepted int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_cycle FROM public.cycles WHERE id = _cycle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_CYCLE'; END IF;
  IF NOT public.is_group_member(v_cycle.group_id, v_uid) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT v_cycle.awaiting_renewal OR v_cycle.renewal_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'RENEWAL_NOT_OPEN';
  END IF;
  IF v_cycle.renewal_deadline IS NOT NULL AND v_cycle.renewal_deadline < now() THEN
    RAISE EXCEPTION 'RENEWAL_DEADLINE_PASSED';
  END IF;

  INSERT INTO public.cycle_renewal_votes (cycle_id, user_id, agreed, voted_at)
  VALUES (_cycle_id, v_uid, _agreed, now())
  ON CONFLICT (cycle_id, user_id) DO UPDATE SET agreed = EXCLUDED.agreed, voted_at = now();

  SELECT count(*) INTO v_accepted
    FROM public.cycle_renewal_votes v
    JOIN public.group_members gm
      ON gm.user_id = v.user_id AND gm.group_id = v_cycle.group_id AND gm.status = 'active'
   WHERE v.cycle_id = _cycle_id AND v.agreed;

  IF v_cycle.renewal_min_members IS NOT NULL
     AND v_accepted >= v_cycle.renewal_min_members
     AND v_cycle.renewal_threshold_notified_at IS NULL THEN
    UPDATE public.cycles SET renewal_threshold_notified_at = now() WHERE id = _cycle_id;
    SELECT created_by INTO v_org FROM public.groups WHERE id = v_cycle.group_id;
    PERFORM public.dispatch_notification(
      v_org, 'system'::public.notification_kind,
      'Seuil atteint',
      v_accepted || ' membres ont confirmé leur participation. Vous pouvez démarrer le nouveau cycle.',
      jsonb_build_object('group_id', v_cycle.group_id, 'cycle_id', _cycle_id),
      v_cycle.group_id,
      '/group/' || v_cycle.group_id
    );
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.vote_cycle_renewal(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.vote_cycle_renewal(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------
-- Etat du renouvellement (tous les membres)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.renewal_status(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cycle public.cycles%ROWTYPE;
  v_group public.groups%ROWTYPE;
  v_eligible int; v_accepted int; v_declined int;
  v_prev_members int; v_my boolean; v_names jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_group_member(_group_id, v_uid) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = _group_id;
  SELECT * INTO v_cycle FROM public.cycles
   WHERE group_id = _group_id ORDER BY cycle_number DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('open', false); END IF;

  SELECT count(*) INTO v_eligible FROM public.group_members
   WHERE group_id = _group_id AND status = 'active';

  SELECT count(*) FILTER (WHERE v.agreed), count(*) FILTER (WHERE NOT v.agreed)
    INTO v_accepted, v_declined
    FROM public.cycle_renewal_votes v
    JOIN public.group_members gm
      ON gm.user_id = v.user_id AND gm.group_id = _group_id AND gm.status = 'active'
   WHERE v.cycle_id = v_cycle.id;

  SELECT count(DISTINCT t.beneficiary_user_id) INTO v_prev_members
    FROM public.turns t WHERE t.cycle_id = v_cycle.id;

  SELECT agreed INTO v_my FROM public.cycle_renewal_votes
   WHERE cycle_id = v_cycle.id AND user_id = v_uid;

  SELECT coalesce(jsonb_agg(p.full_name ORDER BY v.voted_at), '[]'::jsonb) INTO v_names
    FROM public.cycle_renewal_votes v
    LEFT JOIN public.profiles p ON p.user_id = v.user_id
    JOIN public.group_members gm
      ON gm.user_id = v.user_id AND gm.group_id = _group_id AND gm.status = 'active'
   WHERE v.cycle_id = v_cycle.id AND v.agreed;

  RETURN jsonb_build_object(
    'cycle_id', v_cycle.id,
    'cycle_number', v_cycle.cycle_number,
    'open', v_cycle.awaiting_renewal AND v_cycle.renewal_closed_at IS NULL,
    'expired', v_cycle.renewal_deadline IS NOT NULL AND v_cycle.renewal_deadline < now(),
    'deadline', v_cycle.renewal_deadline,
    'min_members', v_cycle.renewal_min_members,
    'eligible', v_eligible,
    'accepted', coalesce(v_accepted, 0),
    'declined', coalesce(v_declined, 0),
    'pending', greatest(v_eligible - coalesce(v_accepted, 0) - coalesce(v_declined, 0), 0),
    'my_vote', v_my,
    'is_organizer', public.is_group_organizer(_group_id, v_uid),
    'contribution_amount', v_group.contribution_amount,
    'frequency', v_group.frequency::text,
    'projected_payout', v_group.contribution_amount * coalesce(v_accepted, 0),
    'projected_turns', coalesce(v_accepted, 0),
    'previous_members', coalesce(v_prev_members, 0),
    'previous_payout', v_group.contribution_amount * coalesce(v_prev_members, 0),
    'confirmed_names', v_names
  );
END $$;

REVOKE ALL ON FUNCTION public.renewal_status(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.renewal_status(uuid) TO authenticated;

-- ---------------------------------------------------------------
-- Prolonger / annuler
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.extend_cycle_renewal(
  _cycle_id uuid, _deadline timestamptz, _min_members int DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_group uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT group_id INTO v_group FROM public.cycles WHERE id = _cycle_id;
  IF v_group IS NULL THEN RAISE EXCEPTION 'NO_CYCLE'; END IF;
  IF NOT public.is_group_organizer(v_group, v_uid) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _deadline <= now() THEN RAISE EXCEPTION 'DEADLINE_IN_PAST'; END IF;
  IF _min_members IS NOT NULL AND _min_members < 2 THEN RAISE EXCEPTION 'MIN_MEMBERS_TOO_LOW'; END IF;

  UPDATE public.cycles
     SET renewal_deadline = _deadline,
         renewal_min_members = coalesce(_min_members, renewal_min_members),
         renewal_expiry_notified_at = NULL,
         renewal_threshold_notified_at = NULL
   WHERE id = _cycle_id;

  PERFORM public.dispatch_notification(
    gm.user_id, 'system'::public.notification_kind,
    'Délai prolongé',
    'Vous avez jusqu''au ' || to_char(_deadline, 'DD/MM/YYYY') || ' pour confirmer votre participation au prochain cycle.',
    jsonb_build_object('group_id', v_group, 'cycle_id', _cycle_id),
    v_group, '/group/' || v_group
  )
  FROM public.group_members gm
  WHERE gm.group_id = v_group AND gm.status = 'active' AND gm.user_id <> v_uid
    AND NOT EXISTS (SELECT 1 FROM public.cycle_renewal_votes v
                    WHERE v.cycle_id = _cycle_id AND v.user_id = gm.user_id);
END $$;

REVOKE ALL ON FUNCTION public.extend_cycle_renewal(uuid, timestamptz, int) FROM public;
GRANT EXECUTE ON FUNCTION public.extend_cycle_renewal(uuid, timestamptz, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_cycle_renewal(_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_group uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT group_id INTO v_group FROM public.cycles WHERE id = _cycle_id;
  IF v_group IS NULL THEN RAISE EXCEPTION 'NO_CYCLE'; END IF;
  IF NOT public.is_group_organizer(v_group, v_uid) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  UPDATE public.cycles
     SET awaiting_renewal = false, renewal_closed_at = now()
   WHERE id = _cycle_id;

  PERFORM public.dispatch_notification(
    gm.user_id, 'system'::public.notification_kind,
    'Relance annulée',
    'La proposition de nouveau cycle a été annulée par l''organisateur.',
    jsonb_build_object('group_id', v_group, 'cycle_id', _cycle_id),
    v_group, '/group/' || v_group
  )
  FROM public.group_members gm
  WHERE gm.group_id = v_group AND gm.status = 'active' AND gm.user_id <> v_uid;
END $$;

REVOKE ALL ON FUNCTION public.cancel_cycle_renewal(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_cycle_renewal(uuid) TO authenticated;

-- ---------------------------------------------------------------
-- Démarrage du nouveau cycle avec les membres confirmés
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_renewed_cycle(_group_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cycle public.cycles%ROWTYPE;
  v_accepted int;
  v_new_cycle uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_group_organizer(_group_id, v_uid) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_group_id::text, 42));

  SELECT * INTO v_cycle FROM public.cycles
   WHERE group_id = _group_id ORDER BY cycle_number DESC LIMIT 1;
  IF NOT FOUND OR NOT v_cycle.awaiting_renewal OR v_cycle.renewal_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'RENEWAL_NOT_OPEN';
  END IF;

  SELECT count(*) INTO v_accepted
    FROM public.cycle_renewal_votes v
    JOIN public.group_members gm
      ON gm.user_id = v.user_id AND gm.group_id = _group_id AND gm.status = 'active'
   WHERE v.cycle_id = v_cycle.id AND v.agreed;

  IF v_accepted < 2 THEN RAISE EXCEPTION 'QUORUM_NOT_REACHED'; END IF;
  IF v_cycle.renewal_min_members IS NOT NULL AND v_accepted < v_cycle.renewal_min_members THEN
    RAISE EXCEPTION 'MIN_MEMBERS_NOT_REACHED';
  END IF;

  -- les membres qui n'ont pas confirmé quittent le groupe
  UPDATE public.group_members gm
     SET status = 'left'::public.member_status,
         removed_at = now(),
         removed_reason = 'non_participation_nouveau_cycle',
         removed_by = v_uid,
         position = NULL
   WHERE gm.group_id = _group_id
     AND gm.status = 'active'
     AND NOT EXISTS (
       SELECT 1 FROM public.cycle_renewal_votes v
       WHERE v.cycle_id = v_cycle.id AND v.user_id = gm.user_id AND v.agreed
     );

  -- rangs entièrement réinitialisés : start_cycle régénère la rotation
  UPDATE public.group_members SET position = NULL
   WHERE group_id = _group_id AND status = 'active';

  UPDATE public.cycles
     SET awaiting_renewal = false, renewal_closed_at = now(), ended_at = coalesce(ended_at, now())
   WHERE id = v_cycle.id;

  PERFORM set_config('app.via_rpc', '1', TRUE);
  UPDATE public.groups SET status = 'open'::public.group_status, archived_at = NULL
   WHERE id = _group_id;

  v_new_cycle := public.start_cycle(_group_id);
  RETURN v_new_cycle;
END $$;

REVOKE ALL ON FUNCTION public.start_renewed_cycle(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.start_renewed_cycle(uuid) TO authenticated;

-- ---------------------------------------------------------------
-- Notification d'expiration du délai (cron quotidien)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_expired_renewals()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_n int := 0; v_accepted int;
BEGIN
  FOR r IN
    SELECT c.id, c.group_id, c.renewal_min_members, g.created_by
      FROM public.cycles c JOIN public.groups g ON g.id = c.group_id
     WHERE c.awaiting_renewal AND c.renewal_closed_at IS NULL
       AND c.renewal_deadline IS NOT NULL AND c.renewal_deadline < now()
       AND c.renewal_expiry_notified_at IS NULL
  LOOP
    SELECT count(*) INTO v_accepted
      FROM public.cycle_renewal_votes v
      JOIN public.group_members gm
        ON gm.user_id = v.user_id AND gm.group_id = r.group_id AND gm.status = 'active'
     WHERE v.cycle_id = r.id AND v.agreed;

    PERFORM public.dispatch_notification(
      r.created_by, 'system'::public.notification_kind,
      'Délai de relance expiré',
      v_accepted || ' membres ont confirmé leur participation. Vous pouvez démarrer le cycle, prolonger le délai ou annuler la relance.',
      jsonb_build_object('group_id', r.group_id, 'cycle_id', r.id),
      r.group_id, '/group/' || r.group_id
    );
    UPDATE public.cycles SET renewal_expiry_notified_at = now() WHERE id = r.id;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION public.notify_expired_renewals() FROM public;

DO $$
BEGIN
  PERFORM cron.unschedule('notify-expired-renewals');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'notify-expired-renewals',
  '0 8 * * *',
  $$SELECT public.notify_expired_renewals();$$
);
