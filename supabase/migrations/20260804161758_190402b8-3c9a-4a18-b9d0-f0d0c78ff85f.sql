CREATE OR REPLACE FUNCTION public.renewal_status(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
    LEFT JOIN public.profiles p ON p.id = v.user_id
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
END $function$;

CREATE OR REPLACE FUNCTION public.list_renewal_votes(_cycle_id uuid)
RETURNS TABLE(user_id uuid, agreed boolean, voted_at timestamp with time zone, full_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_org uuid;
BEGIN
  SELECT g.created_by INTO v_org
  FROM public.cycles c JOIN public.groups g ON g.id=c.group_id
  WHERE c.id=_cycle_id;
  IF v_org <> v_uid THEN RAISE EXCEPTION 'only_organizer'; END IF;
  RETURN QUERY
  SELECT v.user_id, v.agreed, v.voted_at, p.full_name
  FROM public.cycle_renewal_votes v
  LEFT JOIN public.profiles p ON p.id = v.user_id
  WHERE v.cycle_id=_cycle_id;
END; $function$;