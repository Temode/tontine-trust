
CREATE OR REPLACE FUNCTION public.apply_subscription_webhook(
  _subscription_id uuid, _new_status text, _djomy_ref text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _mapped public.subscription_status;
  _uid uuid;
  _current public.subscription_status;
BEGIN
  SELECT user_id, status INTO _uid, _current
    FROM public.user_subscriptions WHERE id = _subscription_id;
  IF _uid IS NULL THEN RETURN; END IF;

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

  -- Idempotence : rien à faire si l'état cible est déjà atteint.
  IF _current = _mapped THEN
    IF _djomy_ref IS NOT NULL THEN
      UPDATE public.user_subscriptions
         SET djomy_ref = COALESCE(djomy_ref, _djomy_ref)
       WHERE id = _subscription_id;
    END IF;
    RETURN;
  END IF;

  -- Bascule atomique : clôturer les précédents actifs pour respecter user_subs_active_uniq.
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
         cancelled_at = CASE WHEN _mapped = 'cancelled' AND cancelled_at IS NULL
                             THEN now() ELSE cancelled_at END,
         updated_at = now()
   WHERE id = _subscription_id;
END; $$;
