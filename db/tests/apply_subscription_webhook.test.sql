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
  v_free uuid;
  v_prem uuid;
  v_prem2 uuid;
  v_active_count int;
  v_period_before timestamptz;
  v_period_after timestamptz;
  v_status public.subscription_status;
BEGIN
  -- Utilisateur de test dans auth.users (nécessaire pour la FK).
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'apply_sub_wh_' || v_user || '@test.local', crypt('x', gen_salt('bf')),
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

  -- Ligne Free active pré-existante (créée à l'inscription du user réel).
  INSERT INTO public.user_subscriptions(user_id, plan_code, tier_options, price_monthly, status, current_period_end)
  VALUES (v_user, 'free', '{}'::jsonb, 0, 'active', now() + interval '100 years')
  RETURNING id INTO v_free;

  -- Ligne Premium pending (créée par start_subscription_checkout).
  INSERT INTO public.user_subscriptions(user_id, plan_code, tier_options, price_monthly, status, djomy_ref)
  VALUES (v_user, 'premium', '{}'::jsonb, 13800, 'pending', 'tx_test_1')
  RETURNING id INTO v_prem;

  -- (1) Upgrade Free → Premium
  PERFORM public.apply_subscription_webhook(v_prem, 'succeeded', 'tx_test_1');

  SELECT count(*) INTO v_active_count
    FROM public.user_subscriptions
   WHERE user_id = v_user AND status IN ('active','trialing','past_due');
  IF v_active_count <> 1 THEN
    RAISE EXCEPTION 'FAIL (1): attendait 1 ligne active, obtenu %', v_active_count;
  END IF;

  SELECT status INTO v_status FROM public.user_subscriptions WHERE id = v_prem;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'FAIL (1): premium.status = % (attendu active)', v_status;
  END IF;

  SELECT status INTO v_status FROM public.user_subscriptions WHERE id = v_free;
  IF v_status <> 'cancelled' THEN
    RAISE EXCEPTION 'FAIL (1): free.status = % (attendu cancelled)', v_status;
  END IF;

  -- (2) Idempotence : rejouer succeeded ne change pas current_period_end.
  SELECT current_period_end INTO v_period_before FROM public.user_subscriptions WHERE id = v_prem;
  PERFORM pg_sleep(0.05);
  PERFORM public.apply_subscription_webhook(v_prem, 'succeeded', 'tx_test_1');
  SELECT current_period_end INTO v_period_after FROM public.user_subscriptions WHERE id = v_prem;
  IF v_period_before <> v_period_after THEN
    RAISE EXCEPTION 'FAIL (2): current_period_end modifié par un rejeu (before=% after=%)', v_period_before, v_period_after;
  END IF;

  -- (3) Nouveau pending premium puis webhook failed → past_due.
  INSERT INTO public.user_subscriptions(user_id, plan_code, tier_options, price_monthly, status, djomy_ref)
  VALUES (v_user, 'premium', '{}'::jsonb, 15000, 'pending', 'tx_test_2')
  RETURNING id INTO v_prem2;

  PERFORM public.apply_subscription_webhook(v_prem2, 'failed', 'tx_test_2');
  SELECT status INTO v_status FROM public.user_subscriptions WHERE id = v_prem2;
  IF v_status <> 'past_due' THEN
    RAISE EXCEPTION 'FAIL (3): status = % (attendu past_due)', v_status;
  END IF;

  -- La ligne active précédente doit rester active (failed ne clôture pas les autres).
  SELECT status INTO v_status FROM public.user_subscriptions WHERE id = v_prem;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'FAIL (3): la ligne active ne doit pas être touchée par un failed (status=%)', v_status;
  END IF;

  -- (4) Rejeu d'un cancelled sur v_prem2 (déjà past_due) → cancelled, idempotent au second appel.
  PERFORM public.apply_subscription_webhook(v_prem2, 'cancelled', NULL);
  PERFORM public.apply_subscription_webhook(v_prem2, 'cancelled', NULL);
  SELECT status INTO v_status FROM public.user_subscriptions WHERE id = v_prem2;
  IF v_status <> 'cancelled' THEN
    RAISE EXCEPTION 'FAIL (4): status = % (attendu cancelled)', v_status;
  END IF;

  -- Nettoyage
  DELETE FROM public.user_subscriptions WHERE user_id = v_user;
  DELETE FROM auth.users WHERE id = v_user;

  RAISE NOTICE 'apply_subscription_webhook: tous les scénarios OK.';
END
$test$;