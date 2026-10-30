
-- Extend get_my_entitlements with member usage
CREATE OR REPLACE FUNCTION public.get_my_entitlements()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _sub public.user_subscriptions;
  _plan public.subscription_plans;
  _groups_used int;
  _members_total int;
  _members_max_in_group int;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('authenticated', false);
  END IF;

  SELECT * INTO _sub
    FROM public.user_subscriptions
    WHERE user_id = _uid
    ORDER BY updated_at DESC
    LIMIT 1;

  IF NOT FOUND OR _sub.status NOT IN ('active','trialing') THEN
    SELECT * INTO _plan FROM public.subscription_plans WHERE code = 'free';
  ELSE
    SELECT * INTO _plan FROM public.subscription_plans WHERE code = _sub.plan_code;
    IF _sub.plan_code = 'premium' AND jsonb_typeof(_sub.tier_options) = 'object' THEN
      _plan.limits := _plan.limits || _sub.tier_options;
    END IF;
  END IF;

  SELECT count(*) INTO _groups_used
    FROM public.groups
    WHERE created_by = _uid
      AND status NOT IN ('cancelled','completed')
      AND deleted_at IS NULL;

  SELECT COALESCE(SUM(c), 0), COALESCE(MAX(c), 0)
    INTO _members_total, _members_max_in_group
  FROM (
    SELECT count(*)::int AS c
    FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE g.created_by = _uid
      AND g.status NOT IN ('cancelled','completed')
      AND g.deleted_at IS NULL
      AND gm.status IN ('active','invited','pending')
    GROUP BY gm.group_id
  ) sub;

  RETURN jsonb_build_object(
    'authenticated', true,
    'plan_code', _plan.code,
    'plan_label', _plan.label,
    'base_price', _plan.base_price,
    'sms_included', _plan.sms_included,
    'limits', _plan.limits,
    'status', COALESCE(_sub.status::text, 'free'),
    'current_period_end', _sub.current_period_end,
    'price_monthly', COALESCE(_sub.price_monthly, _plan.base_price),
    'tier_options', COALESCE(_sub.tier_options, '{}'::jsonb),
    'read_only', COALESCE(_sub.status IN ('past_due','cancelled'), false),
    'usage', jsonb_build_object(
      'groups', _groups_used,
      'members_total', _members_total,
      'max_members_in_group', _members_max_in_group
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_entitlements() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_entitlements() TO authenticated;

-- Backend hardening: prevent bypassing quotas by reactivating cancelled/completed groups
CREATE OR REPLACE FUNCTION public.enforce_group_quota_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limits jsonb;
  _max int;
  _used int;
BEGIN
  -- Only re-check when transitioning from a "not counted" state back to a counted state
  IF NEW.created_by IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(NEW.created_by, 'super_admin') THEN RETURN NEW; END IF;

  IF (OLD.status IN ('cancelled','completed') OR OLD.deleted_at IS NOT NULL)
     AND (NEW.status NOT IN ('cancelled','completed') AND NEW.deleted_at IS NULL) THEN
    _limits := public.user_effective_limits(NEW.created_by);
    _max := COALESCE((_limits->>'max_groups')::int, 2);
    IF _max = -1 THEN RETURN NEW; END IF;
    SELECT count(*) INTO _used FROM public.groups
      WHERE created_by = NEW.created_by
        AND status NOT IN ('cancelled','completed')
        AND deleted_at IS NULL
        AND id <> NEW.id;
    IF _used >= _max THEN
      RAISE EXCEPTION 'QUOTA_GROUPS_EXCEEDED' USING ERRCODE = '42501',
        DETAIL = format('plan_limit=%s used=%s (revive blocked)', _max, _used);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_group_quota_upd ON public.groups;
CREATE TRIGGER trg_enforce_group_quota_upd
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_quota_on_update();

CREATE OR REPLACE FUNCTION public.enforce_member_quota_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _grp public.groups;
  _limits jsonb;
  _max int;
  _used int;
BEGIN
  IF NEW.status NOT IN ('active','invited','pending') THEN RETURN NEW; END IF;
  IF OLD.status IN ('active','invited','pending') THEN RETURN NEW; END IF;

  SELECT * INTO _grp FROM public.groups WHERE id = NEW.group_id;
  IF NOT FOUND OR _grp.created_by IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(_grp.created_by, 'super_admin') THEN RETURN NEW; END IF;

  _limits := public.user_effective_limits(_grp.created_by);
  _max := COALESCE((_limits->>'max_members_per_group')::int, 5);
  IF _max = -1 THEN RETURN NEW; END IF;

  SELECT count(*) INTO _used FROM public.group_members
    WHERE group_id = NEW.group_id
      AND status IN ('active','invited','pending')
      AND id <> NEW.id;
  IF _used >= _max THEN
    RAISE EXCEPTION 'QUOTA_MEMBERS_EXCEEDED' USING ERRCODE = '42501',
      DETAIL = format('plan_limit=%s used=%s (revive blocked)', _max, _used);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_member_quota_upd ON public.group_members;
CREATE TRIGGER trg_enforce_member_quota_upd
  BEFORE UPDATE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_quota_on_update();
