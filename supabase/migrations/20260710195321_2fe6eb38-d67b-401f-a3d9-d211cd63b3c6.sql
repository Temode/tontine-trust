CREATE OR REPLACE FUNCTION public.enforce_solo_withdrawal_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _g public.groups%ROWTYPE;
BEGIN
  IF NEW.group_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO _g FROM public.groups WHERE id = NEW.group_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF _g.kind = 'solo'::public.group_kind
     AND _g.solo_mode = 'project'::public.solo_mode
     AND _g.solo_lock_until IS NOT NULL
     AND _g.solo_lock_until > now() THEN
    RAISE EXCEPTION 'SOLO_LOCKED_UNTIL:%', to_char(_g.solo_lock_until, 'YYYY-MM-DD"T"HH24:MI:SSOF')
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_solo_withdrawal_lock ON public.withdrawal_requests;
CREATE TRIGGER trg_solo_withdrawal_lock
  BEFORE INSERT ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_solo_withdrawal_lock();

CREATE OR REPLACE FUNCTION public.enforce_solo_single_member()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'solo'::public.group_kind AND coalesce(NEW.max_members, 1) <> 1 THEN
    NEW.max_members := 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_solo_single_member ON public.groups;
CREATE TRIGGER trg_solo_single_member
  BEFORE INSERT OR UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.enforce_solo_single_member();

CREATE OR REPLACE FUNCTION public.create_solo_group(
  _name text, _description text, _category text,
  _mode public.solo_mode, _contribution bigint,
  _frequency public.group_frequency, _lock_until timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
   WHERE created_by = _uid AND kind = 'solo'::public.group_kind AND status <> 'archived';
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
    _contribution, coalesce(_frequency, 'mensuelle'::public.group_frequency), 1,
    'fixed'::public.rotation_order, 0, 0,
    'active', 'private'::public.group_visibility, '{}'::text[], _uid,
    false, false, 0,
    'solo'::public.group_kind, _mode, _lock_until
  ) RETURNING id INTO _group_id;

  INSERT INTO public.group_members (group_id, user_id, role, status, joined_at)
  VALUES (_group_id, _uid, 'organisateur', 'active', now());

  RETURN jsonb_build_object('group_id', _group_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_solo_group(text, text, text, public.solo_mode, bigint, public.group_frequency, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.create_solo_group(text, text, text, public.solo_mode, bigint, public.group_frequency, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_my_solo_groups()
RETURNS TABLE (
  id uuid, name text, description text, category text,
  contribution_amount bigint, frequency public.group_frequency,
  solo_mode public.solo_mode, solo_lock_until timestamptz,
  created_at timestamptz, status text,
  total_saved bigint, target_amount bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mine AS (
    SELECT g.* FROM public.groups g
     WHERE g.created_by = auth.uid()
       AND g.kind = 'solo'::public.group_kind
  ),
  sums AS (
    SELECT c.group_id, coalesce(sum(c.amount)::bigint, 0) AS total_saved
      FROM public.contributions c
      JOIN mine ON mine.id = c.group_id
     WHERE c.status = 'confirmed'::public.contribution_status
     GROUP BY c.group_id
  )
  SELECT m.id, m.name, m.description, m.category,
         m.contribution_amount, m.frequency, m.solo_mode, m.solo_lock_until,
         m.created_at, m.status::text,
         coalesce(s.total_saved, 0) AS total_saved,
         CASE
           WHEN m.solo_mode = 'project'::public.solo_mode AND m.solo_lock_until IS NOT NULL THEN
             m.contribution_amount * GREATEST(1, (
               CASE m.frequency
                 WHEN 'quotidienne'::public.group_frequency THEN GREATEST(1, EXTRACT(EPOCH FROM (m.solo_lock_until - m.created_at))::int / 86400)
                 WHEN 'hebdomadaire'::public.group_frequency THEN GREATEST(1, EXTRACT(EPOCH FROM (m.solo_lock_until - m.created_at))::int / (86400*7))
                 WHEN 'quinzaine'::public.group_frequency    THEN GREATEST(1, EXTRACT(EPOCH FROM (m.solo_lock_until - m.created_at))::int / (86400*14))
                 ELSE GREATEST(1, EXTRACT(YEAR FROM age(m.solo_lock_until, m.created_at))::int * 12 + EXTRACT(MONTH FROM age(m.solo_lock_until, m.created_at))::int)
               END
             )::int)
           ELSE NULL
         END AS target_amount
    FROM mine m
    LEFT JOIN sums s ON s.group_id = m.id
   ORDER BY m.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_my_solo_groups() FROM public;
GRANT EXECUTE ON FUNCTION public.list_my_solo_groups() TO authenticated;