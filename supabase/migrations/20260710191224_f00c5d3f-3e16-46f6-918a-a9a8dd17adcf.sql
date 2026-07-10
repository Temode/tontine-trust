
-- M3: entitlements, quota guards, subscription checkout & webhook

-- Compute Premium price from tier options (integers only, floor at min_price, cap at max_price)
CREATE OR REPLACE FUNCTION public.compute_premium_price(_options jsonb)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.subscription_plans;
  _tiers jsonb;
  _min integer;
  _max integer;
  _price integer;
  _opt jsonb;
  _base integer;
  _chosen integer;
  _step integer;
BEGIN
  SELECT * INTO _plan FROM public.subscription_plans WHERE code = 'premium';
  IF NOT FOUND THEN RETURN 0; END IF;
  _tiers := _plan.tiers;
  _min := COALESCE((_tiers->>'min_price')::int, _plan.base_price);
  _max := COALESCE((_tiers->>'max_price')::int, _plan.base_price * 4);
  _price := _min;
  IF jsonb_typeof(_tiers->'options') = 'array' THEN
    FOR _opt IN SELECT * FROM jsonb_array_elements(_tiers->'options') LOOP
      _base := COALESCE((_opt->>'base')::int, 0);
      _step := COALESCE((_opt->>'price_step')::int, 0);
      _chosen := COALESCE((_options->>(_opt->>'key'))::int, _base);
      IF _chosen > _base THEN
        _price := _price + (_chosen - _base) * _step;
      END IF;
    END LOOP;
  END IF;
  RETURN LEAST(GREATEST(_price, _min), _max);
END;
$$;

REVOKE ALL ON FUNCTION public.compute_premium_price(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.compute_premium_price(jsonb) TO authenticated, anon;

-- Entitlements aggregate for the current user
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
  _limits jsonb;
  _groups_used int;
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
    -- merge tier_options into limits so quotas reflect what the user paid for
    IF _sub.plan_code = 'premium' AND jsonb_typeof(_sub.tier_options) = 'object' THEN
      _plan.limits := _plan.limits || _sub.tier_options;
    END IF;
  END IF;

  SELECT count(*) INTO _groups_used
    FROM public.groups
    WHERE created_by = _uid
      AND status NOT IN ('cancelled','completed')
      AND deleted_at IS NULL;

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
    'usage', jsonb_build_object('groups', _groups_used)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_entitlements() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_entitlements() TO authenticated;

-- Helper: resolve effective limits for a given user (Free by default)
CREATE OR REPLACE FUNCTION public.user_effective_limits(_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub public.user_subscriptions;
  _plan public.subscription_plans;
BEGIN
  SELECT * INTO _sub FROM public.user_subscriptions
    WHERE user_id = _uid ORDER BY updated_at DESC LIMIT 1;
  IF NOT FOUND OR _sub.status NOT IN ('active','trialing') THEN
    SELECT * INTO _plan FROM public.subscription_plans WHERE code = 'free';
  ELSE
    SELECT * INTO _plan FROM public.subscription_plans WHERE code = _sub.plan_code;
    IF _sub.plan_code = 'premium' AND jsonb_typeof(_sub.tier_options) = 'object' THEN
      _plan.limits := _plan.limits || _sub.tier_options;
    END IF;
  END IF;
  RETURN _plan.limits;
END;
$$;

REVOKE ALL ON FUNCTION public.user_effective_limits(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.user_effective_limits(uuid) TO authenticated, service_role;

-- Trigger: enforce max_groups on group insert
CREATE OR REPLACE FUNCTION public.enforce_group_quota()
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
  IF NEW.created_by IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(NEW.created_by, 'super_admin') THEN RETURN NEW; END IF;
  _limits := public.user_effective_limits(NEW.created_by);
  _max := COALESCE((_limits->>'max_groups')::int, 2);
  IF _max = -1 THEN RETURN NEW; END IF; -- unlimited
  SELECT count(*) INTO _used FROM public.groups
    WHERE created_by = NEW.created_by
      AND status NOT IN ('cancelled','completed')
      AND deleted_at IS NULL;
  IF _used >= _max THEN
    RAISE EXCEPTION 'QUOTA_GROUPS_EXCEEDED' USING ERRCODE = '42501',
      DETAIL = format('plan_limit=%s used=%s', _max, _used);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_group_quota ON public.groups;
CREATE TRIGGER trg_enforce_group_quota
  BEFORE INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_quota();

-- Trigger: enforce max_members_per_group based on the organizer's plan
CREATE OR REPLACE FUNCTION public.enforce_member_quota()
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
  SELECT * INTO _grp FROM public.groups WHERE id = NEW.group_id;
  IF NOT FOUND OR _grp.created_by IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(_grp.created_by, 'super_admin') THEN RETURN NEW; END IF;
  _limits := public.user_effective_limits(_grp.created_by);
  _max := COALESCE((_limits->>'max_members_per_group')::int, 5);
  IF _max = -1 THEN RETURN NEW; END IF;
  SELECT count(*) INTO _used FROM public.group_members
    WHERE group_id = NEW.group_id
      AND status IN ('active','invited','pending');
  IF _used >= _max THEN
    RAISE EXCEPTION 'QUOTA_MEMBERS_EXCEEDED' USING ERRCODE = '42501',
      DETAIL = format('plan_limit=%s used=%s', _max, _used);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_member_quota ON public.group_members;
CREATE TRIGGER trg_enforce_member_quota
  BEFORE INSERT ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_quota();

-- Start subscription checkout : creates a pending user_subscriptions row and returns its id
CREATE OR REPLACE FUNCTION public.start_subscription_checkout(
  _plan_code public.subscription_plan_code,
  _tier_options jsonb DEFAULT '{}'::jsonb
)
RETURNS public.user_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _plan public.subscription_plans;
  _price int;
  _row public.user_subscriptions;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO _plan FROM public.subscription_plans WHERE code = _plan_code AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_NOT_FOUND'; END IF;

  IF _plan_code = 'premium' THEN
    _price := public.compute_premium_price(_tier_options);
  ELSE
    _price := _plan.base_price;
  END IF;

  IF _plan_code = 'free' THEN
    -- Free doesn't go through Djomy: activate immediately
    INSERT INTO public.user_subscriptions(user_id, plan_code, tier_options, price_monthly, status, current_period_end)
    VALUES (_uid, 'free', '{}'::jsonb, 0, 'active', now() + interval '100 years')
    RETURNING * INTO _row;
    RETURN _row;
  END IF;

  INSERT INTO public.user_subscriptions(user_id, plan_code, tier_options, price_monthly, status, djomy_ref)
  VALUES (_uid, _plan_code, COALESCE(_tier_options, '{}'::jsonb), _price, 'pending', NULL)
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.start_subscription_checkout(public.subscription_plan_code, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.start_subscription_checkout(public.subscription_plan_code, jsonb) TO authenticated;

-- Webhook handler for subscriptions
CREATE OR REPLACE FUNCTION public.apply_subscription_webhook(
  _subscription_id uuid,
  _new_status text,
  _djomy_ref text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mapped public.subscription_status;
BEGIN
  _mapped := CASE _new_status
    WHEN 'succeeded' THEN 'active'::public.subscription_status
    WHEN 'paid'      THEN 'active'::public.subscription_status
    WHEN 'failed'    THEN 'past_due'::public.subscription_status
    WHEN 'cancelled' THEN 'cancelled'::public.subscription_status
    ELSE 'pending'::public.subscription_status
  END;

  UPDATE public.user_subscriptions
     SET status = _mapped,
         djomy_ref = COALESCE(_djomy_ref, djomy_ref),
         current_period_end = CASE WHEN _mapped = 'active' THEN now() + interval '30 days' ELSE current_period_end END,
         updated_at = now()
   WHERE id = _subscription_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_subscription_webhook(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_subscription_webhook(uuid, text, text) TO service_role;
