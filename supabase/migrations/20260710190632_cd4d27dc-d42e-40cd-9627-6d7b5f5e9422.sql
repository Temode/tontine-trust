
-- M2: Admin RPCs for plans, SMS pricing & orders (super_admin only)

CREATE OR REPLACE FUNCTION public.admin_update_subscription_plan(
  _code public.subscription_plan_code,
  _label text,
  _base_price integer,
  _sms_included integer,
  _limits jsonb,
  _tiers jsonb,
  _is_active boolean
)
RETURNS public.subscription_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.subscription_plans;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _base_price < 0 OR _sms_included < 0 THEN
    RAISE EXCEPTION 'invalid_values';
  END IF;

  UPDATE public.subscription_plans
     SET label = _label,
         base_price = _base_price,
         sms_included = _sms_included,
         limits = COALESCE(_limits, limits),
         tiers = COALESCE(_tiers, tiers),
         is_active = _is_active,
         updated_at = now()
   WHERE code = _code
   RETURNING * INTO _row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  INSERT INTO public.subscription_plan_history(plan_code, changed_by, snapshot)
  VALUES (_code, auth.uid(), to_jsonb(_row));

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_subscription_plan(public.subscription_plan_code, text, integer, integer, jsonb, jsonb, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_update_subscription_plan(public.subscription_plan_code, text, integer, integer, jsonb, jsonb, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_publish_sms_pricing(
  _unit_price integer,
  _packs jsonb
)
RETURNS public.sms_pricing
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.sms_pricing;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _unit_price <= 0 OR jsonb_typeof(_packs) <> 'array' THEN
    RAISE EXCEPTION 'invalid_values';
  END IF;

  UPDATE public.sms_pricing SET is_active = false WHERE is_active = true;

  INSERT INTO public.sms_pricing(unit_price, packs, effective_from, is_active, created_by)
  VALUES (_unit_price, _packs, now(), true, auth.uid())
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_publish_sms_pricing(integer, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_publish_sms_pricing(integer, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_sms_order(
  _order_id uuid,
  _status public.sms_order_status,
  _admin_note text
)
RETURNS public.sms_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.sms_orders;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.sms_orders
     SET status = _status,
         admin_note = COALESCE(_admin_note, admin_note),
         updated_at = now()
   WHERE id = _order_id
   RETURNING * INTO _row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_sms_order(uuid, public.sms_order_status, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_update_sms_order(uuid, public.sms_order_status, text) TO authenticated;
