-- 1. Solo groups may have a single member
CREATE OR REPLACE FUNCTION public.validate_group_params()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  _min_members int := 2;
begin
  if new.contribution_amount is null or new.contribution_amount < 1000 then
    raise exception 'La cotisation doit être d''au moins 1 000 GNF.'
      using errcode = 'check_violation';
  end if;

  if new.kind = 'solo'::public.group_kind then
    _min_members := 1;
  end if;

  if new.max_members is null or new.max_members < _min_members or new.max_members > 50 then
    raise exception 'Le nombre de membres doit être compris entre % et 50.', _min_members
      using errcode = 'check_violation';
  end if;

  if new.frequency = 'quotidienne'::public.group_frequency
     and coalesce(new.late_penalty_after_days, 0) > 1 then
    raise exception 'Pour une fréquence quotidienne, le délai avant pénalité ne peut pas dépasser 1 jour.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$function$;

-- 2. Solo creation: idempotent organizer membership
CREATE OR REPLACE FUNCTION public.create_solo_group(_name text, _description text, _category text, _mode solo_mode, _contribution bigint, _frequency group_frequency, _lock_until timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _ent jsonb; _max_solo int; _used_solo int; _group_id uuid;
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
  SELECT count(*) INTO _used_solo
    FROM public.groups
   WHERE created_by = _uid
     AND kind = 'solo'::public.group_kind
     AND archived_at IS NULL
     AND deleted_at IS NULL;
  IF _max_solo <> -1 AND _used_solo >= _max_solo THEN
    RAISE EXCEPTION 'QUOTA_SOLO_EXCEEDED:%/%', _used_solo, _max_solo;
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

  RETURN jsonb_build_object('group_id', _group_id);
END
$function$;

-- 3. Applications aligned with the public directory
CREATE OR REPLACE FUNCTION public.apply_to_international_group(_group_id uuid, _message text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_group public.groups%ROWTYPE;
  v_active_count int;
  v_member_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_group FROM public.groups
   WHERE id = _group_id
     AND deleted_at IS NULL
     AND archived_at IS NULL
     AND kind <> 'solo'::public.group_kind
     AND (
       is_international = true
       OR visibility IN ('directory'::public.group_visibility, 'public-link'::public.group_visibility)
     );
  IF NOT FOUND THEN RAISE EXCEPTION 'group_not_found_or_not_international'; END IF;
  IF v_group.status NOT IN ('draft','open','active') THEN RAISE EXCEPTION 'group_not_open'; END IF;

  IF EXISTS (SELECT 1 FROM public.group_members
             WHERE group_id=_group_id AND user_id=v_uid
               AND status IN ('active','pending','invited')) THEN
    RAISE EXCEPTION 'already_applied_or_member';
  END IF;

  SELECT count(*) INTO v_active_count FROM public.group_members
   WHERE group_id=_group_id AND status='active';
  IF v_active_count >= v_group.max_members THEN RAISE EXCEPTION 'group_full'; END IF;

  INSERT INTO public.group_members (group_id, user_id, role, status, applicant_message)
  VALUES (_group_id, v_uid, 'membre', 'pending', _message)
  ON CONFLICT (group_id, user_id) DO UPDATE
    SET status = 'pending'::public.member_status,
        applicant_message = EXCLUDED.applicant_message
  RETURNING id INTO v_member_id;

  IF v_group.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, kind, title, body, data)
    VALUES (v_group.created_by, 'system'::notification_kind,
      'Nouvelle candidature',
      'Un utilisateur souhaite rejoindre votre tontine.',
      jsonb_build_object('group_id',_group_id,'member_id',v_member_id,
        'url','/group/'||_group_id||'/members'));
  END IF;
  RETURN v_member_id;
END; $function$;