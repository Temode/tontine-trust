CREATE OR REPLACE FUNCTION public.referral_is_paying(_referrer uuid, _referred uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.referral_earnings re
    JOIN public.user_subscriptions s ON s.id = re.subscription_id
    WHERE re.referrer_id = _referrer AND s.user_id = _referred)
$$;
REVOKE EXECUTE ON FUNCTION public.referral_is_paying(uuid,uuid) FROM anon, public;

CREATE OR REPLACE FUNCTION public.get_my_affiliate_summary()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_code text; v_referrals_count int; v_active_count int;
  v_total_earned bigint; v_pending bigint; v_paid bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT referral_code INTO v_code FROM public.profiles WHERE id=v_uid;
  SELECT count(*) INTO v_referrals_count FROM public.referrals WHERE referrer_id=v_uid;
  SELECT count(*) INTO v_active_count FROM public.referrals r
    WHERE r.referrer_id=v_uid AND r.status='active' AND public.referral_is_paying(v_uid, r.referred_id);
  SELECT COALESCE(sum(amount),0) INTO v_total_earned FROM public.referral_earnings WHERE referrer_id=v_uid;
  SELECT COALESCE(sum(amount),0) INTO v_pending FROM public.referral_earnings WHERE referrer_id=v_uid AND paid=false;
  SELECT COALESCE(sum(amount),0) INTO v_paid FROM public.referral_earnings WHERE referrer_id=v_uid AND paid=true;
  RETURN jsonb_build_object('referral_code',v_code,'referrals_count',v_referrals_count,'active_count',v_active_count,
    'total_earned',v_total_earned,'pending',v_pending,'paid',v_paid);
END; $function$;

CREATE OR REPLACE FUNCTION public.get_my_referrer()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object('full_name',
    CASE WHEN p.full_name IS NULL OR btrim(p.full_name)='' OR p.full_name LIKE '%@%'
      THEN 'un membre Tontine Digitale' ELSE p.full_name END,
    'since', r.created_at)
  FROM public.referrals r JOIN public.profiles p ON p.id=r.referrer_id WHERE r.referred_id=auth.uid() LIMIT 1
$function$;