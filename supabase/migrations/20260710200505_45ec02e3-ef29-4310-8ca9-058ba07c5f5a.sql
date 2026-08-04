
-- 2) profiles.referral_code
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code)
  WHERE referral_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_profile_referral_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_code text;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code=v_code);
    END LOOP;
    NEW.referral_code := v_code;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_profiles_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_profile_referral_code();

UPDATE public.profiles
   SET referral_code = upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))
 WHERE referral_code IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='referrals_referred_unique') THEN
    ALTER TABLE public.referrals ADD CONSTRAINT referrals_referred_unique UNIQUE (referred_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='referral_earnings_uniq_period') THEN
    ALTER TABLE public.referral_earnings ADD CONSTRAINT referral_earnings_uniq_period
      UNIQUE (referrer_id, subscription_id, period);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.register_referral(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); v_referrer uuid; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _code IS NULL OR length(trim(_code))=0 THEN RAISE EXCEPTION 'invalid_code'; END IF;
  SELECT id INTO v_referrer FROM public.profiles WHERE referral_code=upper(trim(_code));
  IF v_referrer IS NULL THEN RAISE EXCEPTION 'referrer_not_found'; END IF;
  IF v_referrer=v_uid THEN RAISE EXCEPTION 'self_referral'; END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id=v_uid) THEN
    RAISE EXCEPTION 'already_referred';
  END IF;
  INSERT INTO public.referrals (referrer_id, referred_id, referral_code, commission_percent, status)
  VALUES (v_referrer, v_uid, upper(trim(_code)), 10, 'active')
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.register_referral(text) FROM public;
GRANT EXECUTE ON FUNCTION public.register_referral(text) TO authenticated;

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
    INSERT INTO public.notifications (user_id, kind, title, body, data)
    VALUES (v_ref.referrer_id, 'system'::notification_kind,
      'Nouvelle commission d''affiliation',
      'Un de vos filleuls a payé son abonnement. Une commission vous a été créditée.',
      jsonb_build_object('amount',v_amount,'period',_period,'url','/affiliation'));
  END IF;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.accrue_referral_earning(uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.accrue_referral_earning(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.create_business_group(
  _name text, _description text, _category text, _contribution bigint,
  _frequency public.group_frequency, _max_members int, _commission_percent numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); v_plan text; v_group_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _commission_percent < 0 OR _commission_percent > 20 THEN RAISE EXCEPTION 'invalid_commission_percent'; END IF;
  IF _max_members < 2 THEN RAISE EXCEPTION 'invalid_max_members'; END IF;
  SELECT plan_code::text INTO v_plan FROM public.user_subscriptions
   WHERE user_id=v_uid AND status='active' ORDER BY current_period_end DESC NULLS LAST LIMIT 1;
  IF COALESCE(v_plan,'free') <> 'business' THEN RAISE EXCEPTION 'business_plan_required'; END IF;

  INSERT INTO public.groups (name, description, category, contribution_amount, frequency,
    max_members, status, created_by, kind, coordinator_user_id, coordinator_commission_percent)
  VALUES (_name, _description, _category, _contribution, _frequency,
    _max_members, 'draft', v_uid, 'business', v_uid, _commission_percent)
  RETURNING id INTO v_group_id;

  INSERT INTO public.group_members (group_id, user_id, role, status)
  VALUES (v_group_id, v_uid, 'organisateur', 'active');
  RETURN v_group_id;
END; $$;
REVOKE ALL ON FUNCTION public.create_business_group(text,text,text,bigint,public.group_frequency,int,numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.create_business_group(text,text,text,bigint,public.group_frequency,int,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_coordinator_commission(
  _group_id uuid, _cycle_id uuid, _turn_id uuid, _payment_id uuid,
  _beneficiary_id uuid, _gross_amount bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_g public.groups%ROWTYPE; v_fee bigint := 0; v_net bigint;
BEGIN
  SELECT * INTO v_g FROM public.groups WHERE id=_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'group_not_found'; END IF;
  IF v_g.kind='business' AND v_g.coordinator_user_id IS NOT NULL
     AND COALESCE(v_g.coordinator_commission_percent,0) > 0 THEN
    v_fee := floor(_gross_amount * v_g.coordinator_commission_percent / 100.0);
    v_net := _gross_amount - v_fee;
    INSERT INTO public.ledger_entries (
      group_id, cycle_id, turn_id, payment_id, user_id, entry_type, amount, memo
    ) VALUES (
      _group_id, _cycle_id, _turn_id, _payment_id, v_g.coordinator_user_id,
      'coordinator_fee'::ledger_entry_type, v_fee,
      'Commission coordinateur ' || v_g.coordinator_commission_percent || '%'
    );
  ELSE
    v_net := _gross_amount;
  END IF;
  RETURN jsonb_build_object('gross_amount',_gross_amount,'fee_amount',v_fee,'net_amount',v_net);
END; $$;
REVOKE ALL ON FUNCTION public.apply_coordinator_commission(uuid,uuid,uuid,uuid,uuid,bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_coordinator_commission(uuid,uuid,uuid,uuid,uuid,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_coordinator_commission(uuid,uuid,uuid,uuid,uuid,bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_my_coordinator_commissions()
RETURNS TABLE (entry_id uuid, group_id uuid, group_name text, amount bigint,
  cycle_id uuid, turn_id uuid, created_at timestamptz, memo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT le.id, le.group_id, g.name, le.amount, le.cycle_id, le.turn_id, le.created_at, le.memo
  FROM public.ledger_entries le
  JOIN public.groups g ON g.id=le.group_id
  WHERE le.entry_type='coordinator_fee' AND le.user_id=auth.uid()
  ORDER BY le.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.list_my_coordinator_commissions() FROM public;
GRANT EXECUTE ON FUNCTION public.list_my_coordinator_commissions() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_affiliate_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); v_code text; v_referrals_count int; v_active_count int;
  v_total_earned bigint; v_pending bigint; v_paid bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT referral_code INTO v_code FROM public.profiles WHERE id=v_uid;
  SELECT count(*) INTO v_referrals_count FROM public.referrals WHERE referrer_id=v_uid;
  SELECT count(*) INTO v_active_count FROM public.referrals WHERE referrer_id=v_uid AND status='active';
  SELECT COALESCE(sum(amount),0) INTO v_total_earned FROM public.referral_earnings WHERE referrer_id=v_uid;
  SELECT COALESCE(sum(amount),0) INTO v_pending FROM public.referral_earnings WHERE referrer_id=v_uid AND paid=false;
  SELECT COALESCE(sum(amount),0) INTO v_paid FROM public.referral_earnings WHERE referrer_id=v_uid AND paid=true;
  RETURN jsonb_build_object(
    'referral_code',v_code,'referrals_count',v_referrals_count,'active_count',v_active_count,
    'total_earned',v_total_earned,'pending',v_pending,'paid',v_paid);
END; $$;
REVOKE ALL ON FUNCTION public.get_my_affiliate_summary() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_affiliate_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_my_affiliate_earnings()
RETURNS TABLE (id uuid, subscription_id uuid, period text, amount int,
  paid boolean, paid_at timestamptz, created_at timestamptz, referred_full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT re.id, re.subscription_id, re.period, re.amount, re.paid, re.paid_at, re.created_at, p.full_name
  FROM public.referral_earnings re
  JOIN public.user_subscriptions s ON s.id=re.subscription_id
  LEFT JOIN public.profiles p ON p.id=s.user_id
  WHERE re.referrer_id=auth.uid()
  ORDER BY re.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.list_my_affiliate_earnings() FROM public;
GRANT EXECUTE ON FUNCTION public.list_my_affiliate_earnings() TO authenticated;
