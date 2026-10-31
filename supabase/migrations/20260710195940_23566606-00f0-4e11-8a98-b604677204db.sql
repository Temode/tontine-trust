
-- M7 — Tontine Internationale (fix: group_frequency enum)

ALTER TABLE public.groups ALTER COLUMN is_international SET DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_groups_international_open
  ON public.groups (is_international, status)
  WHERE is_international = true AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.list_international_groups()
RETURNS TABLE (
  group_id uuid, name text, description text, category text,
  contribution_amount bigint, frequency public.group_frequency,
  max_members integer, current_members integer, seats_left integer,
  status public.group_status, avg_reliability numeric, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
  WHERE g.is_international=true AND g.deleted_at IS NULL
    AND g.status IN ('draft','open')
  ORDER BY g.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.list_international_groups() FROM public;
GRANT EXECUTE ON FUNCTION public.list_international_groups() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_international_group_members(_group_id uuid)
RETURNS TABLE (anon_label text, role public.member_role, reliability_score numeric, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    'Membre ' || chr(64 + (row_number() OVER (ORDER BY gm.joined_at NULLS LAST, gm.id))::int),
    gm.role, COALESCE(urs.score,0)::numeric, gm.joined_at
  FROM public.group_members gm
  LEFT JOIN public.user_reliability_scores urs ON urs.user_id=gm.user_id
  JOIN public.groups g ON g.id=gm.group_id
  WHERE gm.group_id=_group_id AND gm.status='active'
    AND g.is_international=true AND g.deleted_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.get_international_group_members(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_international_group_members(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_to_international_group(_group_id uuid, _message text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_group public.groups%ROWTYPE;
  v_active_count int;
  v_member_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_group FROM public.groups
   WHERE id=_group_id AND is_international=true AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'group_not_found_or_not_international'; END IF;
  IF v_group.status NOT IN ('draft','open') THEN RAISE EXCEPTION 'group_not_open'; END IF;

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
  RETURNING id INTO v_member_id;

  IF v_group.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, kind, title, body, data)
    VALUES (v_group.created_by, 'system'::notification_kind,
      'Nouvelle candidature internationale',
      'Un utilisateur souhaite rejoindre votre tontine internationale.',
      jsonb_build_object('group_id',_group_id,'member_id',v_member_id,
        'url','/group/'||_group_id||'/members'));
  END IF;
  RETURN v_member_id;
END; $$;
REVOKE ALL ON FUNCTION public.apply_to_international_group(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_to_international_group(uuid, text) TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cycle_renewal_votes_cycle_user_uniq') THEN
    ALTER TABLE public.cycle_renewal_votes
      ADD CONSTRAINT cycle_renewal_votes_cycle_user_uniq UNIQUE (cycle_id, user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.vote_cycle_renewal(_cycle_id uuid, _agreed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_group_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT group_id INTO v_group_id FROM public.cycles WHERE id=_cycle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'cycle_not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.group_members
                 WHERE group_id=v_group_id AND user_id=v_uid AND status='active') THEN
    RAISE EXCEPTION 'not_member';
  END IF;
  INSERT INTO public.cycle_renewal_votes (cycle_id, user_id, agreed, voted_at)
  VALUES (_cycle_id, v_uid, _agreed, now())
  ON CONFLICT (cycle_id, user_id) DO UPDATE
    SET agreed=EXCLUDED.agreed, voted_at=now();
END; $$;
REVOKE ALL ON FUNCTION public.vote_cycle_renewal(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.vote_cycle_renewal(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_cycle_awaiting_renewal(_cycle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_group_id uuid; v_org uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT c.group_id, g.created_by INTO v_group_id, v_org
  FROM public.cycles c JOIN public.groups g ON g.id=c.group_id
  WHERE c.id=_cycle_id;
  IF v_org <> v_uid THEN RAISE EXCEPTION 'only_organizer'; END IF;
  UPDATE public.cycles SET awaiting_renewal=true WHERE id=_cycle_id;
  INSERT INTO public.notifications (user_id, kind, title, body, data)
  SELECT gm.user_id, 'system'::notification_kind,
         'Renouvellement du cycle',
         'Souhaitez-vous participer au prochain cycle ?',
         jsonb_build_object('group_id',v_group_id,'cycle_id',_cycle_id,'url','/group/'||v_group_id)
  FROM public.group_members gm
  WHERE gm.group_id=v_group_id AND gm.status='active' AND gm.user_id<>v_uid;
END; $$;
REVOKE ALL ON FUNCTION public.mark_cycle_awaiting_renewal(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_cycle_awaiting_renewal(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_renewal_votes(_cycle_id uuid)
RETURNS TABLE (user_id uuid, agreed boolean, voted_at timestamptz, full_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_org uuid;
BEGIN
  SELECT g.created_by INTO v_org
  FROM public.cycles c JOIN public.groups g ON g.id=c.group_id
  WHERE c.id=_cycle_id;
  IF v_org <> v_uid THEN RAISE EXCEPTION 'only_organizer'; END IF;
  RETURN QUERY
  SELECT v.user_id, v.agreed, v.voted_at, p.full_name
  FROM public.cycle_renewal_votes v
  LEFT JOIN public.profiles p ON p.user_id=v.user_id
  WHERE v.cycle_id=_cycle_id;
END; $$;
REVOKE ALL ON FUNCTION public.list_renewal_votes(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.list_renewal_votes(uuid) TO authenticated;
