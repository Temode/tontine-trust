
-- 1) Integrity: coordinator_fee vs payment
CREATE OR REPLACE FUNCTION public.audit_coordinator_commissions()
RETURNS TABLE (
  entry_id uuid, group_id uuid, payment_id uuid, coordinator_user_id uuid,
  ledger_user_id uuid, fee_amount bigint, issue text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    le.id, le.group_id, le.payment_id, g.coordinator_user_id,
    le.user_id, le.amount,
    CASE
      WHEN g.kind <> 'business' THEN 'group_not_business'
      WHEN g.coordinator_user_id IS NULL THEN 'no_coordinator_on_group'
      WHEN le.user_id IS DISTINCT FROM g.coordinator_user_id THEN 'ledger_user_mismatch'
      WHEN le.amount <= 0 THEN 'non_positive_fee'
      WHEN le.payment_id IS NULL THEN 'missing_payment_ref'
      ELSE NULL
    END AS issue
  FROM public.ledger_entries le
  JOIN public.groups g ON g.id = le.group_id
  WHERE le.entry_type = 'coordinator_fee'
    AND (
         g.kind <> 'business'
      OR g.coordinator_user_id IS NULL
      OR le.user_id IS DISTINCT FROM g.coordinator_user_id
      OR le.amount <= 0
      OR le.payment_id IS NULL
    );
$$;
REVOKE ALL ON FUNCTION public.audit_coordinator_commissions() FROM public;
GRANT EXECUTE ON FUNCTION public.audit_coordinator_commissions() TO authenticated;

-- 2) Integrity: referral_earnings vs subscriptions
CREATE OR REPLACE FUNCTION public.audit_referral_earnings()
RETURNS TABLE (
  earning_id uuid, referrer_id uuid, subscription_id uuid, period text,
  amount int, issue text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    re.id, re.referrer_id, re.subscription_id, re.period, re.amount,
    CASE
      WHEN s.id IS NULL THEN 'subscription_missing'
      WHEN r.id IS NULL THEN 'referral_missing'
      WHEN r.referrer_id IS DISTINCT FROM re.referrer_id THEN 'referrer_mismatch'
      WHEN re.amount <= 0 THEN 'non_positive_amount'
      WHEN re.amount > COALESCE(s.price_monthly,0) THEN 'amount_exceeds_price'
      ELSE NULL
    END AS issue
  FROM public.referral_earnings re
  LEFT JOIN public.user_subscriptions s ON s.id = re.subscription_id
  LEFT JOIN public.referrals r ON r.referred_id = s.user_id
  WHERE
       s.id IS NULL
    OR r.id IS NULL
    OR r.referrer_id IS DISTINCT FROM re.referrer_id
    OR re.amount <= 0
    OR re.amount > COALESCE(s.price_monthly,0);
$$;
REVOKE ALL ON FUNCTION public.audit_referral_earnings() FROM public;
GRANT EXECUTE ON FUNCTION public.audit_referral_earnings() TO authenticated;

-- 3) Admin: list referrals with filters
CREATE OR REPLACE FUNCTION public.admin_list_referrals(
  _status text DEFAULT NULL,
  _search text DEFAULT NULL
)
RETURNS TABLE (
  id uuid, referrer_id uuid, referrer_name text, referrer_code text,
  referred_id uuid, referred_name text, status public.referral_status,
  commission_percent numeric, created_at timestamptz,
  total_earned bigint, pending_amount bigint, paid_amount bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT
    r.id, r.referrer_id, pr.full_name, pr.referral_code,
    r.referred_id, pd.full_name, r.status, r.commission_percent, r.created_at,
    COALESCE((SELECT sum(re.amount) FROM public.referral_earnings re
              WHERE re.referrer_id=r.referrer_id
                AND re.subscription_id IN (SELECT s.id FROM public.user_subscriptions s WHERE s.user_id=r.referred_id)),0),
    COALESCE((SELECT sum(re.amount) FROM public.referral_earnings re
              WHERE re.referrer_id=r.referrer_id AND re.paid=false
                AND re.subscription_id IN (SELECT s.id FROM public.user_subscriptions s WHERE s.user_id=r.referred_id)),0),
    COALESCE((SELECT sum(re.amount) FROM public.referral_earnings re
              WHERE re.referrer_id=r.referrer_id AND re.paid=true
                AND re.subscription_id IN (SELECT s.id FROM public.user_subscriptions s WHERE s.user_id=r.referred_id)),0)
  FROM public.referrals r
  LEFT JOIN public.profiles pr ON pr.id=r.referrer_id
  LEFT JOIN public.profiles pd ON pd.id=r.referred_id
  WHERE (_status IS NULL OR r.status::text = _status)
    AND (
      _search IS NULL OR _search='' OR
      pr.full_name ILIKE '%'||_search||'%' OR
      pd.full_name ILIKE '%'||_search||'%' OR
      pr.referral_code ILIKE '%'||_search||'%'
    )
  ORDER BY r.created_at DESC;
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_referrals(text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_referrals(text,text) TO authenticated;

-- 4) Admin: list earnings with filters
CREATE OR REPLACE FUNCTION public.admin_list_referral_earnings(
  _paid boolean DEFAULT NULL,
  _referrer_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid, referrer_id uuid, referrer_name text,
  subscription_id uuid, referred_id uuid, referred_name text,
  period text, amount int, paid boolean, paid_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT re.id, re.referrer_id, pr.full_name, re.subscription_id, s.user_id, pd.full_name,
         re.period, re.amount, re.paid, re.paid_at, re.created_at
  FROM public.referral_earnings re
  LEFT JOIN public.user_subscriptions s ON s.id=re.subscription_id
  LEFT JOIN public.profiles pr ON pr.id=re.referrer_id
  LEFT JOIN public.profiles pd ON pd.id=s.user_id
  WHERE (_paid IS NULL OR re.paid=_paid)
    AND (_referrer_id IS NULL OR re.referrer_id=_referrer_id)
  ORDER BY re.created_at DESC;
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_referral_earnings(boolean,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_referral_earnings(boolean,uuid) TO authenticated;

-- 5) Admin: mark earning paid
CREATE OR REPLACE FUNCTION public.admin_mark_referral_earning_paid(_id uuid, _paid boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.referral_earnings
     SET paid=_paid, paid_at = CASE WHEN _paid THEN now() ELSE NULL END
   WHERE id=_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_mark_referral_earning_paid(uuid,boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_mark_referral_earning_paid(uuid,boolean) TO authenticated;

-- 6) Admin: change referral status
CREATE OR REPLACE FUNCTION public.admin_set_referral_status(_id uuid, _status public.referral_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.referrals SET status=_status, updated_at=now() WHERE id=_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_referral_status(uuid,public.referral_status) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_referral_status(uuid,public.referral_status) TO authenticated;
