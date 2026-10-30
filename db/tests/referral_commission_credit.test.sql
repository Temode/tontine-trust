-- Commission de parrainage créditée au solde du parrain.
-- Exécution : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/referral_commission_credit.test.sql
-- (1) Abonnement payé 5 000 GNF → commission 500 GNF (10 %) dans le solde, marquée payée.
-- (2) Même période rejouée → aucun second crédit.
BEGIN;
DO $test$
DECLARE
  v_referrer uuid; v_referred uuid; v_sub uuid; v_before bigint; v_after bigint; v_n int;
BEGIN
  SELECT referrer_id, referred_id INTO v_referrer, v_referred FROM public.referrals WHERE status='active' LIMIT 1;
  IF v_referrer IS NULL THEN RAISE NOTICE 'aucun parrainage actif, test ignoré'; RETURN; END IF;
  SELECT COALESCE(sum(available_amount),0) INTO v_before FROM public.beneficiary_balances WHERE user_id=v_referrer;
  INSERT INTO public.user_subscriptions (user_id, plan_code, price_monthly, status)
  VALUES (v_referred, 'premium', 5000, 'active') RETURNING id INTO v_sub;

  PERFORM public.accrue_referral_earning(v_sub, 'test-p1');
  PERFORM public.accrue_referral_earning(v_sub, 'test-p1');

  SELECT COALESCE(sum(available_amount),0) INTO v_after FROM public.beneficiary_balances WHERE user_id=v_referrer;
  IF v_after - v_before <> 500 THEN RAISE EXCEPTION 'crédit attendu 500, obtenu %', v_after - v_before; END IF;
  SELECT count(*) INTO v_n FROM public.referral_earnings WHERE subscription_id=v_sub AND paid;
  IF v_n <> 1 THEN RAISE EXCEPTION 'une seule commission payée attendue, obtenu %', v_n; END IF;
  RAISE NOTICE 'OK commission parrainage';
END $test$;
ROLLBACK;
