-- Conditions générales : acceptation simple (remplace la signature OTP pour le démarrage de cycle)

CREATE OR REPLACE FUNCTION public.current_terms_version()
RETURNS TABLE (version text, content text, published_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT t.version, t.content, t.published_at
  FROM public.app_terms_versions t
  ORDER BY t.published_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_terms_version() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_group_terms(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_t record;
  v_accepted timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_t FROM public.current_terms_version();
  IF NOT FOUND THEN RAISE EXCEPTION 'TERMS_NOT_FOUND'; END IF;

  SELECT max(accepted_at) INTO v_accepted
    FROM public.group_consent_log
   WHERE group_id = _group_id AND user_id = v_uid AND terms_version = v_t.version;

  RETURN jsonb_build_object(
    'version', v_t.version,
    'content', v_t.content,
    'published_at', v_t.published_at,
    'accepted_at', v_accepted,
    'accepted', v_accepted IS NOT NULL
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_group_terms(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_group_terms(_group_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_version text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_group_member(_group_id, v_uid) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT version INTO v_version FROM public.current_terms_version();
  IF v_version IS NULL THEN RAISE EXCEPTION 'TERMS_NOT_FOUND'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_consent_log
     WHERE group_id = _group_id AND user_id = v_uid AND terms_version = v_version
  ) THEN
    INSERT INTO public.group_consent_log (user_id, group_id, terms_version, accepted_at)
    VALUES (v_uid, _group_id, v_version, now());
  END IF;

  RETURN v_version;
END $$;

GRANT EXECUTE ON FUNCTION public.accept_group_terms(uuid) TO authenticated;

-- start_cycle : la signature électronique du contrat n'est plus requise.
-- Les membres actifs doivent avoir accepté les conditions générales en vigueur.
CREATE OR REPLACE FUNCTION public.start_cycle(_group_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_group public.groups%ROWTYPE;
  v_count int;
  v_cycle_id uuid;
  v_cycle_number int;
  v_freq_days int;
  v_payout bigint;
  v_due date;
  v_terms_version text;
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

  SELECT version INTO v_terms_version FROM public.current_terms_version();
  IF v_terms_version IS NULL THEN RAISE EXCEPTION 'TERMS_NOT_FOUND'; END IF;
  SELECT COUNT(*) INTO v_unsigned
  FROM public.group_members gm
  WHERE gm.group_id = _group_id AND gm.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.group_consent_log gc
      WHERE gc.group_id = _group_id
        AND gc.user_id = gm.user_id
        AND gc.terms_version = v_terms_version
    );
  IF v_unsigned > 0 THEN RAISE EXCEPTION 'TERMS_NOT_ACCEPTED'; END IF;

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
END $function$;