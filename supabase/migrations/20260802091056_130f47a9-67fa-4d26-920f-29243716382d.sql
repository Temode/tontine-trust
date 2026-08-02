CREATE OR REPLACE FUNCTION public.create_solo_group(
  _name text,
  _description text,
  _category text,
  _mode public.solo_mode,
  _contribution bigint,
  _frequency public.group_frequency,
  _lock_until timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _ent jsonb; _max_solo int; _used_solo int; _group_id uuid; _plan text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF coalesce(_name,'') = '' THEN RAISE EXCEPTION 'NAME_REQUIRED'; END IF;
  IF _contribution IS NULL OR _contribution <= 0 THEN RAISE EXCEPTION 'INVALID_CONTRIBUTION'; END IF;
  IF _mode IS NULL THEN RAISE EXCEPTION 'INVALID_SOLO_MODE'; END IF;
  IF _mode = 'project'::public.solo_mode THEN
    IF _lock_until IS NULL OR _lock_until <= now() THEN
      RAISE EXCEPTION 'INVALID_SOLO_LOCK_UNTIL';
    END IF;
  END IF;

  SELECT public.get_my_entitlements() INTO _ent;
  _max_solo := coalesce((_ent->'limits'->>'max_solo')::int, 0);
  _plan := coalesce(_ent->>'plan_code', 'free');
  SELECT count(*) INTO _used_solo
    FROM public.groups
   WHERE created_by = _uid
     AND kind = 'solo'::public.group_kind
     AND archived_at IS NULL
     AND deleted_at IS NULL;
  IF _max_solo <> -1 AND _used_solo >= _max_solo THEN
    RAISE EXCEPTION 'QUOTA_SOLO_EXCEEDED:%/%:%', _used_solo, _max_solo, _plan;
  END IF;

  INSERT INTO public.groups (
    name, description, category, contribution_amount, frequency, max_members,
    rotation_order_kind, late_penalty_percent, late_penalty_after_days,
    status, visibility, co_organizers, created_by,
    new_member_lock_last_third, deposit_required, deposit_months,
    kind, solo_mode, solo_lock_until
  ) VALUES (
    _name, nullif(_description,''), nullif(_category,''),
    _contribution, coalesce(_frequency,'mensuelle'::public.group_frequency), 1,
    'fixed'::public.rotation_order, 0, 0,
    'active'::public.group_status, 'private'::public.group_visibility, '{}'::text[], _uid,
    false, false, 0,
    'solo'::public.group_kind, _mode, _lock_until
  ) RETURNING id INTO _group_id;

  INSERT INTO public.group_members (group_id, user_id, role, status, joined_at)
  VALUES (_group_id, _uid, 'organisateur'::public.member_role, 'active'::public.member_status, now())
  ON CONFLICT (group_id, user_id) DO UPDATE
    SET role = 'organisateur'::public.member_role,
        status = 'active'::public.member_status,
        joined_at = COALESCE(public.group_members.joined_at, now());

  -- Confirmation : notification in-app (déclenche l'e-mail via la file d'attente) + SMS
  BEGIN
    PERFORM public.dispatch_notification(
      _uid,
      'system'::public.notification_kind,
      'Tontine Solo créée',
      format('Votre tontine Solo « %s » est active : %s GNF / %s.',
             _name, to_char(_contribution, 'FM999G999G999'),
             coalesce(_frequency::text, 'mensuelle')),
      jsonb_build_object('group_id', _group_id, 'kind', 'solo', 'solo_mode', _mode::text),
      _group_id,
      '/groupes/' || _group_id::text
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    PERFORM public.enqueue_generic_sms(
      'solo_created',
      ARRAY[_uid],
      format('Tontine Digitale : votre tontine Solo "%s" a ete creee (%s GNF / %s).',
             _name, to_char(_contribution, 'FM999G999G999'),
             coalesce(_frequency::text, 'mensuelle')),
      _group_id
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('group_id', _group_id);
END
$fn$;