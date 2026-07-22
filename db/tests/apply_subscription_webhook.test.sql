-- Tests d'intégration : public.apply_subscription_webhook
--
-- Exécution :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/apply_subscription_webhook.test.sql
--
-- Scénarios couverts :
--   (1) Upgrade Free→Premium : l'activation d'un pending Premium clôture la ligne
--       Free active du même user sans violer user_subs_active_uniq.
--   (2) Idempotence : rejouer 'succeeded' sur un abonnement déjà actif est un no-op
--       et ne réécrase pas current_period_end.
--   (3) Webhook 'failed' → status past_due.
--   (4) Rejeu d'un webhook 'cancelled' sur une ligne active ne remet pas une autre
--       ligne clôturée en actif.

DO $test$
DECLARE
  v_user uuid := gen_random_uuid();
  v_free uuid; v_prem uuid; v_prem2 uuid;
  v_active_count int;
  v_period_before timestamptz;
  v_period_after timestamptz;
  v_status public.subscription_status;
  v_ent jsonb;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'apply_sub_wh_' || v_user || '@test.local', 'x',
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

  INSERT INTO public.user_subscriptions(user_id, plan_code, tier_options, price_monthly, status, current_period_end)
  VALUES (v_user, 'free', '{}'::jsonb, 0, 'active', now() + interval '100 years')
  RETURNING id INTO v_free;

  INSERT INTO public.user_subscriptions(user_id, plan_code, tier_options, price_monthly, status, djomy_ref)
  VALUES (v_user, 'premium', '{}'::jsonb, 13800, 'pending', 'tx_test_1')
  RETURNING id INTO v_prem;

  -- (1) Upgrade Free -> Premium : le pending devient actif et le free est clôturé.
  PERFORM public.apply_subscription_webhook(v_prem, 'succeeded', 'tx_test_1');
  SELECT count(*) INTO v_active_count FROM public.user_subscriptions
    WHERE user_id = v_user AND status IN ('active','trialing','past_due');
  IF v_active_count <> 1 THEN RAISE EXCEPTION 'FAIL (1): actives=%', v_active_count; END IF;
  SELECT status INTO v_status FROM public.user_subscriptions WHERE id = v_prem;
  IF v_status <> 'active' THEN RAISE EXCEPTION 'FAIL (1) prem=%', v_status; END IF;
  SELECT status INTO v_status FROM public.user_subscriptions WHERE id = v_free;
  IF v_status <> 'cancelled' THEN RAISE EXCEPTION 'FAIL (1) free=%', v_status; END IF;

  -- (1b) Même timestamp sur lignes active/cancelled : les droits doivent rester Premium.
  UPDATE public.user_subscriptions
     SET updated_at = '2030-01-01 00:00:00+00'::timestamptz
   WHERE id IN (v_free, v_prem);
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  SELECT public.get_my_entitlements() INTO v_ent;
  IF v_ent->>'plan_code' <> 'premium' OR v_ent->>'status' <> 'active' THEN
    RAISE EXCEPTION 'FAIL (1b): entitlements=%', v_ent;
  END IF;

  -- (2) Idempotence : rejouer succeeded ne recalcule pas current_period_end.
  SELECT current_period_end INTO v_period_before FROM public.user_subscriptions WHERE id = v_prem;
  PERFORM pg_sleep(0.05);
  PERFORM public.apply_subscription_webhook(v_prem, 'succeeded', 'tx_test_1');
  SELECT current_period_end INTO v_period_after FROM public.user_subscriptions WHERE id = v_prem;
  IF v_period_before <> v_period_after THEN
    RAISE EXCEPTION 'FAIL (2): current_period_end mute (before=% after=%)', v_period_before, v_period_after;
  END IF;

  -- (3) Un pending qui échoue devient cancelled (pas past_due) et n'altère pas l'actif.
  INSERT INTO public.user_subscriptions(user_id, plan_code, tier_options, price_monthly, status, djomy_ref)
  VALUES (v_user, 'premium', '{}'::jsonb, 15000, 'pending', 'tx_test_2')
  RETURNING id INTO v_prem2;
  PERFORM public.apply_subscription_webhook(v_prem2, 'failed', 'tx_test_2');
  SELECT status INTO v_status FROM public.user_subscriptions WHERE id = v_prem2;
  IF v_status <> 'cancelled' THEN RAISE EXCEPTION 'FAIL (3) prem2=%', v_status; END IF;
  SELECT status INTO v_status FROM public.user_subscriptions WHERE id = v_prem;
  IF v_status <> 'active' THEN RAISE EXCEPTION 'FAIL (3) active mutee=%', v_status; END IF;

  -- (4) Rejeu d'un cancelled = idempotent.
  PERFORM public.apply_subscription_webhook(v_prem2, 'cancelled', NULL);
  SELECT status INTO v_status FROM public.user_subscriptions WHERE id = v_prem2;
  IF v_status <> 'cancelled' THEN RAISE EXCEPTION 'FAIL (4) prem2=%', v_status; END IF;

  -- (5) Un actif dont le renouvellement échoue passe en past_due.
  PERFORM public.apply_subscription_webhook(v_prem, 'failed', NULL);
  SELECT status INTO v_status FROM public.user_subscriptions WHERE id = v_prem;
  IF v_status <> 'past_due' THEN RAISE EXCEPTION 'FAIL (5) prem=%', v_status; END IF;

  DELETE FROM public.user_subscriptions WHERE user_id = v_user;
  DELETE FROM auth.users WHERE id = v_user;

  RAISE NOTICE 'apply_subscription_webhook: tous les scenarios OK.';
END
$test$;