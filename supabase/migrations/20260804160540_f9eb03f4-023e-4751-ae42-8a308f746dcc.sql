-- 1. Une seule ligne de consentement par (membre, groupe, version)
DELETE FROM public.group_consent_log a
 USING public.group_consent_log b
 WHERE a.ctid < b.ctid
   AND a.user_id = b.user_id AND a.group_id = b.group_id AND a.terms_version = b.terms_version;

CREATE UNIQUE INDEX IF NOT EXISTS group_consent_log_unique_idx
  ON public.group_consent_log (user_id, group_id, terms_version);

CREATE OR REPLACE FUNCTION public.accept_group_terms(_group_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_version text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_group_member(_group_id, v_uid) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT version INTO v_version FROM public.current_terms_version();
  IF v_version IS NULL THEN RAISE EXCEPTION 'TERMS_NOT_FOUND'; END IF;

  INSERT INTO public.group_consent_log (user_id, group_id, terms_version, accepted_at)
  VALUES (v_uid, _group_id, v_version, now())
  ON CONFLICT (user_id, group_id, terms_version) DO NOTHING;

  RETURN v_version;
END $function$;

-- 2. Confirmation à l'organisateur au lancement de la demande de relance
CREATE OR REPLACE FUNCTION public.open_cycle_renewal(_group_id uuid, _min_members integer, _deadline timestamp with time zone)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_cycle public.cycles%ROWTYPE;
  v_active int;
  v_group_name text;
  r RECORD;
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

  INSERT INTO public.cycle_renewal_votes (cycle_id, user_id, agreed, voted_at)
  VALUES (v_cycle.id, v_uid, true, now())
  ON CONFLICT (cycle_id, user_id) DO UPDATE SET agreed = true, voted_at = now();

  FOR r IN SELECT gm.user_id FROM public.group_members gm
            WHERE gm.group_id = _group_id AND gm.status = 'active' AND gm.user_id <> v_uid
  LOOP
    PERFORM public.dispatch_renewal_notification(
      r.user_id, 'Nouveau cycle proposé',
      'L''organisateur propose de relancer la tontine. Consultez le détail du cycle, acceptez les conditions puis confirmez votre participation avant le '
        || to_char(_deadline, 'DD/MM/YYYY') || '.',
      _group_id, v_cycle.id, 'renewal_open');
  END LOOP;

  SELECT name INTO v_group_name FROM public.groups WHERE id = _group_id;

  PERFORM public.dispatch_renewal_notification(
    v_uid, 'Demande de démarrage envoyée',
    'Votre demande de démarrage du nouveau cycle de « ' || coalesce(v_group_name, 'la tontine')
      || ' » a bien été envoyée à ' || (v_active - 1) || ' membre(s). Seuil requis : '
      || _min_members || ' participants confirmés avant le ' || to_char(_deadline, 'DD/MM/YYYY')
      || '. Vous serez prévenu dès que le seuil sera atteint.',
    _group_id, v_cycle.id, 'renewal_open_confirmation');

  RETURN v_cycle.id;
END $function$;

-- 3. Le vote « je participe » exige l'acceptation des conditions + accusé de réception
CREATE OR REPLACE FUNCTION public.vote_cycle_renewal(_cycle_id uuid, _agreed boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_cycle public.cycles%ROWTYPE;
  v_org uuid;
  v_accepted int;
  v_version text;
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

  IF _agreed THEN
    SELECT version INTO v_version FROM public.current_terms_version();
    IF NOT EXISTS (
      SELECT 1 FROM public.group_consent_log
       WHERE group_id = v_cycle.group_id AND user_id = v_uid AND terms_version = v_version
    ) THEN
      RAISE EXCEPTION 'TERMS_NOT_ACCEPTED';
    END IF;
  END IF;

  INSERT INTO public.cycle_renewal_votes (cycle_id, user_id, agreed, voted_at)
  VALUES (_cycle_id, v_uid, _agreed, now())
  ON CONFLICT (cycle_id, user_id) DO UPDATE SET agreed = EXCLUDED.agreed, voted_at = now();

  PERFORM public.dispatch_renewal_notification(
    v_uid,
    CASE WHEN _agreed THEN 'Participation confirmée' ELSE 'Réponse enregistrée' END,
    CASE WHEN _agreed
      THEN 'Votre participation au nouveau cycle est enregistrée, conditions acceptées. Vous serez prévenu dès son démarrage.'
      ELSE 'Vous avez indiqué ne pas participer au nouveau cycle. Vous pouvez changer d''avis avant la date limite.'
    END,
    v_cycle.group_id, _cycle_id, 'renewal_vote_receipt');

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
    PERFORM public.dispatch_renewal_notification(
      v_org, 'Seuil atteint',
      v_accepted || ' membres ont confirmé leur participation. Vous pouvez démarrer le nouveau cycle.',
      v_cycle.group_id, _cycle_id, 'renewal_threshold');
  END IF;
END $function$;