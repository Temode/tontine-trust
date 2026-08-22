-- Tests d'intégration : crédit des SMS inclus dans l'abonnement
--
-- Exécution :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/subscription_sms_grant.test.sql
--
-- Scénarios couverts :
--   (1) Activation d'un Premium → solde inclus = sms_included du plan, une seule
--       écriture 'plan_grant' au grand livre.
--   (2) Rejeu du webhook 'succeeded' → aucun crédit supplémentaire (idempotence).
--   (3) Consommation → les SMS inclus sont débités en premier.
--   (4) Renouvellement (nouvelle période) → remise à la valeur du plan sans report
--       du reliquat inclus, les SMS achetés restent intacts.

DO $test$
DECLARE
  v_user uuid := gen_random_uuid();
  v_sub uuid;
  v_quota int;
  v_grants int;
  v_bal int;
  v_incl int;
BEGIN
  SELECT sms_included INTO v_quota FROM public.subscription_plans WHERE code = 'premium';
  IF COALESCE(v_quota, 0) <= 0 THEN
    RAISE EXCEPTION 'précondition: le plan premium doit inclure des SMS';
  END IF;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'sms_grant_' || v_user || '@test.local', 'x',
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

  INSERT INTO public.user_subscriptions (user_id, plan_code, status, current_period_end)
  VALUES (v_user, 'premium', 'pending', now() + interval '30 days')
  RETURNING id INTO v_sub;

  -- (1) activation
  PERFORM public.apply_subscription_webhook(v_sub, 'succeeded', 'test-ref-1');

  SELECT balance_remaining, included_remaining INTO v_bal, v_incl
    FROM public.sms_wallets WHERE user_id = v_user;
  IF COALESCE(v_bal, 0) <> v_quota OR COALESCE(v_incl, 0) <> v_quota THEN
    RAISE EXCEPTION '(1) solde attendu %, obtenu % (inclus %)', v_quota, v_bal, v_incl;
  END IF;

  SELECT count(*) INTO v_grants FROM public.sms_ledger
   WHERE user_id = v_user AND reason = 'plan_grant';
  IF v_grants <> 1 THEN
    RAISE EXCEPTION '(1) une seule écriture plan_grant attendue, obtenu %', v_grants;
  END IF;

  -- (2) rejeu du webhook
  PERFORM public.apply_subscription_webhook(v_sub, 'succeeded', 'test-ref-1');
  SELECT balance_remaining INTO v_bal FROM public.sms_wallets WHERE user_id = v_user;
  SELECT count(*) INTO v_grants FROM public.sms_ledger
   WHERE user_id = v_user AND reason = 'plan_grant';
  IF v_bal <> v_quota OR v_grants <> 1 THEN
    RAISE EXCEPTION '(2) rejeu non idempotent : solde=% grants=%', v_bal, v_grants;
  END IF;

  -- (3) consommation : les SMS inclus partent en premier
  PERFORM public.sms_wallet_credit(v_user, 10, 'purchase', NULL, '{}'::jsonb);
  PERFORM public.sms_wallet_debit(v_user, 4, 'consumption', NULL, '{}'::jsonb);
  SELECT balance_remaining, included_remaining INTO v_bal, v_incl
    FROM public.sms_wallets WHERE user_id = v_user;
  IF v_bal <> v_quota + 6 OR v_incl <> v_quota - 4 THEN
    RAISE EXCEPTION '(3) débit incorrect : solde=% inclus=%', v_bal, v_incl;
  END IF;

  -- (4) renouvellement : remise à la valeur du plan, achats préservés
  UPDATE public.user_subscriptions
     SET current_period_end = now() + interval '60 days'
   WHERE id = v_sub;
  PERFORM public.grant_subscription_sms(v_sub);

  SELECT balance_remaining, included_remaining INTO v_bal, v_incl
    FROM public.sms_wallets WHERE user_id = v_user;
  IF v_incl <> v_quota OR v_bal <> v_quota + 10 - 4 THEN
    RAISE EXCEPTION '(4) renouvellement incorrect : solde=% inclus=%', v_bal, v_incl;
  END IF;

  RAISE NOTICE 'OK — crédit des SMS inclus conforme (quota=%)', v_quota;

  DELETE FROM auth.users WHERE id = v_user;
END
$test$;
