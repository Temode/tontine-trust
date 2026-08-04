CREATE OR REPLACE FUNCTION public.apply_subscription_webhook(
  _subscription_id uuid,
  _new_status text,
  _djomy_ref text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _mapped public.subscription_status;
  _uid uuid;
  _current public.subscription_status;
BEGIN
  SELECT user_id, status INTO _uid, _current
    FROM public.user_subscriptions
   WHERE id = _subscription_id
   FOR UPDATE;

  IF _uid IS NULL THEN
    RETURN;
  END IF;

  _mapped := CASE _new_status
    WHEN 'succeeded' THEN 'active'::public.subscription_status
    WHEN 'paid'      THEN 'active'::public.subscription_status
    WHEN 'failed'    THEN
      CASE WHEN _current IN ('active','trialing')
           THEN 'past_due'::public.subscription_status
           ELSE 'cancelled'::public.subscription_status
      END
    WHEN 'cancelled' THEN 'cancelled'::public.subscription_status
    ELSE 'pending'::public.subscription_status
  END;

  -- Idempotence : rejouer un état déjà atteint ne modifie ni période ni statut.
  IF _current = _mapped THEN
    IF _djomy_ref IS NOT NULL THEN
      UPDATE public.user_subscriptions
         SET djomy_ref = COALESCE(djomy_ref, _djomy_ref)
       WHERE id = _subscription_id;
    END IF;
    RETURN;
  END IF;

  -- Un événement pending tardif ne doit jamais rétrograder une ligne déjà finalisée.
  IF _mapped = 'pending' AND _current IN ('active','trialing','past_due','cancelled') THEN
    IF _djomy_ref IS NOT NULL THEN
      UPDATE public.user_subscriptions
         SET djomy_ref = COALESCE(djomy_ref, _djomy_ref)
       WHERE id = _subscription_id;
    END IF;
    RETURN;
  END IF;

  -- Bascule atomique : verrouiller puis clôturer les précédents actifs avant d'activer la nouvelle ligne.
  IF _mapped = 'active' THEN
    PERFORM 1
      FROM public.user_subscriptions
     WHERE user_id = _uid
       AND id <> _subscription_id
       AND status IN ('active','trialing','past_due')
     FOR UPDATE;

    UPDATE public.user_subscriptions
       SET status = 'cancelled',
           cancelled_at = COALESCE(cancelled_at, now()),
           updated_at = now()
     WHERE user_id = _uid
       AND id <> _subscription_id
       AND status IN ('active','trialing','past_due');
  END IF;

  UPDATE public.user_subscriptions
     SET status = _mapped,
         djomy_ref = COALESCE(_djomy_ref, djomy_ref),
         current_period_end = CASE WHEN _mapped = 'active'
                                   THEN COALESCE(current_period_end, now() + interval '30 days')
                                   ELSE current_period_end END,
         cancelled_at = CASE WHEN _mapped = 'cancelled' AND cancelled_at IS NULL
                             THEN now() ELSE cancelled_at END,
         updated_at = now()
   WHERE id = _subscription_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_subscription_webhook(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_subscription_webhook(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_entitlements()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    ORDER BY
      CASE
        WHEN status IN ('active','trialing') THEN 0
        WHEN status = 'past_due' THEN 1
        WHEN status = 'pending' THEN 2
        ELSE 3
      END,
      updated_at DESC,
      created_at DESC,
      id DESC
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
$function$;

REVOKE ALL ON FUNCTION public.get_my_entitlements() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_entitlements() TO authenticated;