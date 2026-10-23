SET LOCAL session_replication_role = replica;
INSERT INTO public.groups (id, name, contribution_amount, max_members, status, created_by, kind, is_test_group, visibility)
VALUES ('00000000-0000-0000-0000-00000000aff1', 'Commissions de parrainage', 1, 2, 'completed', '13194888-7c74-44c4-9816-7f4ac7bc882a', 'business', true, 'private')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = origin;

CREATE OR REPLACE FUNCTION public.credit_referral_earning(_earning_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.referral_earnings%ROWTYPE;
  v_group constant uuid := '00000000-0000-0000-0000-00000000aff1';
BEGIN
  SELECT * INTO e FROM public.referral_earnings WHERE id=_earning_id FOR UPDATE;
  IF NOT FOUND OR e.paid OR e.amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.beneficiary_balances (user_id, group_id, available_amount, total_credited, total_withdrawn)
  VALUES (e.referrer_id, v_group, e.amount, e.amount, 0)
  ON CONFLICT (user_id, group_id) DO UPDATE
    SET available_amount = beneficiary_balances.available_amount + EXCLUDED.available_amount,
        total_credited = beneficiary_balances.total_credited + EXCLUDED.total_credited,
        updated_at = now();
  UPDATE public.referral_earnings SET paid=true, paid_at=now() WHERE id=e.id;
  PERFORM public.record_platform_entry('platform_revenue','adjustment','out', e.amount,
    'referral_commission:out:'||e.id, e.referrer_id, v_group, NULL, NULL, e.subscription_id, NULL,
    'Commission de parrainage '||e.period);
  PERFORM public.record_platform_entry('client_escrow','adjustment','in', e.amount,
    'referral_commission:in:'||e.id, e.referrer_id, v_group, NULL, NULL, e.subscription_id, NULL,
    'Commission de parrainage créditée au solde '||e.period);
END; $$;
REVOKE ALL ON FUNCTION public.credit_referral_earning(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_referral_earning(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.accrue_referral_earning(_subscription_id uuid, _period text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_sub public.user_subscriptions%ROWTYPE; v_ref public.referrals%ROWTYPE; v_amount int; v_id uuid;
BEGIN
  SELECT * INTO v_sub FROM public.user_subscriptions WHERE id=_subscription_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'subscription_not_found'; END IF;
  SELECT * INTO v_ref FROM public.referrals WHERE referred_id=v_sub.user_id AND status='active';
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_amount := floor(COALESCE(v_sub.price_monthly,0) * COALESCE(v_ref.commission_percent,10) / 100.0);
  IF v_amount <= 0 THEN RETURN NULL; END IF;
  INSERT INTO public.referral_earnings (referrer_id, subscription_id, period, amount, paid)
  VALUES (v_ref.referrer_id, _subscription_id, _period, v_amount, false)
  ON CONFLICT (referrer_id, subscription_id, period) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    PERFORM public.credit_referral_earning(v_id);
    INSERT INTO public.notifications (user_id, kind, title, body, data)
    VALUES (v_ref.referrer_id, 'system'::notification_kind,
      'Commission de parrainage créditée',
      'Un de vos filleuls a payé son abonnement. '||to_char(v_amount,'FM999G999G999')||' GNF ont été ajoutés à votre solde.',
      jsonb_build_object('amount',v_amount,'period',_period,'url','/solde'));
  END IF;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.accrue_referral_earning(uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.accrue_referral_earning(uuid,text) TO service_role;

DO $b$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.referral_earnings WHERE paid=false LOOP
    PERFORM public.credit_referral_earning(r.id);
  END LOOP;
END $b$;