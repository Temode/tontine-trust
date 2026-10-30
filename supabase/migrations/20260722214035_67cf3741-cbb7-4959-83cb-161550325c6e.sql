
CREATE OR REPLACE FUNCTION public.create_solo_group(
  _name text, _description text, _category text, _mode solo_mode,
  _contribution bigint, _frequency group_frequency, _lock_until timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public'
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
  VALUES (_group_id, _uid, 'organisateur'::public.member_role, 'active'::public.member_status, now());

  RETURN jsonb_build_object('group_id', _group_id);
END
$function$;

CREATE OR REPLACE FUNCTION public.list_international_groups()
RETURNS TABLE(
  group_id uuid, name text, description text, category text,
  contribution_amount bigint, frequency group_frequency, max_members integer,
  current_members integer, seats_left integer, status group_status,
  avg_reliability numeric, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public'
AS $function$
  SELECT g.id, g.name, g.description, g.category, g.contribution_amount,
    g.frequency, g.max_members,
    COALESCE(mc.cnt,0)::int, GREATEST(g.max_members - COALESCE(mc.cnt,0),0)::int,
    g.status, COALESCE(rs.avg_score,0)::numeric, g.created_at
  FROM public.groups g
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS cnt FROM public.group_members gm
    WHERE gm.group_id=g.id AND gm.status='active'
  ) mc ON true
  LEFT JOIN LATERAL (
    SELECT avg(urs.score) AS avg_score
    FROM public.group_members gm2
    JOIN public.user_reliability_scores urs ON urs.user_id=gm2.user_id
    WHERE gm2.group_id=g.id AND gm2.status='active'
  ) rs ON true
  WHERE g.deleted_at IS NULL
    AND g.archived_at IS NULL
    AND g.status IN ('draft','open','active')
    AND g.kind <> 'solo'::public.group_kind
    AND (
      g.is_international = true
      OR g.visibility IN ('directory'::public.group_visibility, 'public-link'::public.group_visibility)
    )
  ORDER BY g.created_at DESC;
$function$;
