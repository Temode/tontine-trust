
CREATE OR REPLACE FUNCTION public.apply_subscription_webhook(
  _subscription_id uuid, _new_status text, _djomy_ref text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _mapped public.subscription_status;
  _uid uuid;
BEGIN
  _mapped := CASE _new_status
    WHEN 'succeeded' THEN 'active'::public.subscription_status
    WHEN 'paid'      THEN 'active'::public.subscription_status
    WHEN 'failed'    THEN 'past_due'::public.subscription_status
    WHEN 'cancelled' THEN 'cancelled'::public.subscription_status
    ELSE 'pending'::public.subscription_status
  END;

  SELECT user_id INTO _uid FROM public.user_subscriptions WHERE id = _subscription_id;
  IF _uid IS NULL THEN RETURN; END IF;

  IF _mapped = 'active' THEN
    UPDATE public.user_subscriptions
       SET status = 'cancelled', cancelled_at = now(), updated_at = now()
     WHERE user_id = _uid
       AND id <> _subscription_id
       AND status IN ('active','trialing','past_due');
  END IF;

  UPDATE public.user_subscriptions
     SET status = _mapped,
         djomy_ref = COALESCE(_djomy_ref, djomy_ref),
         current_period_end = CASE WHEN _mapped = 'active'
                                   THEN now() + interval '30 days'
                                   ELSE current_period_end END,
         updated_at = now()
   WHERE id = _subscription_id;
END; $$;

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
    INSERT INTO public.user_subscriptions(user_id, plan_code, tier_options, price_monthly, status, current_period_end)
    VALUES (_uid, 'free', '{}'::jsonb, 0, 'active', now() + interval '100 years')
    RETURNING * INTO _row;
    RETURN _row;
  END IF;

  -- Réutiliser un pending existant pour ce plan pour éviter d'empiler les lignes.
  SELECT * INTO _row FROM public.user_subscriptions
   WHERE user_id = _uid AND plan_code = _plan_code AND status = 'pending'
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    UPDATE public.user_subscriptions
       SET tier_options = COALESCE(_tier_options, '{}'::jsonb),
           price_monthly = _price,
           updated_at = now()
     WHERE id = _row.id
     RETURNING * INTO _row;
    RETURN _row;
  END IF;

  INSERT INTO public.user_subscriptions(user_id, plan_code, tier_options, price_monthly, status, djomy_ref)
  VALUES (_uid, _plan_code, COALESCE(_tier_options, '{}'::jsonb), _price, 'pending', NULL)
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;
