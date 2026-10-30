DROP FUNCTION IF EXISTS public.backfill_subscription_sms();
CREATE FUNCTION public.backfill_subscription_sms()
RETURNS TABLE(out_user_id uuid, credited integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _r record;
  _qty int;
  _months int;
  _total int;
BEGIN
  FOR _r IN
    SELECT s.* FROM public.user_subscriptions s
     WHERE s.status IN ('active','trialing')
       AND s.plan_code IN ('premium','business')
  LOOP
    SELECT sms_included INTO _qty FROM public.subscription_plans WHERE code = _r.plan_code;
    IF COALESCE(_qty,0) <= 0 THEN CONTINUE; END IF;

    IF EXISTS (SELECT 1 FROM public.sms_ledger l
                WHERE l.user_id = _r.user_id AND l.reason = 'plan_grant') THEN
      CONTINUE;
    END IF;

    _months := GREATEST(1, ceil(EXTRACT(epoch FROM (now() - _r.created_at)) / 2592000.0)::int);
    _total  := _qty * _months;

    INSERT INTO public.sms_wallets AS w (user_id, balance_remaining, included_remaining, total_granted)
    VALUES (_r.user_id, _total, _qty, _total)
    ON CONFLICT (user_id) DO UPDATE
       SET balance_remaining  = w.balance_remaining + _total,
           included_remaining = GREATEST(w.included_remaining, _qty),
           total_granted      = w.total_granted + _total,
           updated_at         = now();

    INSERT INTO public.sms_ledger (user_id, delta, reason, ref_id, metadata)
    VALUES (_r.user_id, _total, 'plan_grant', _r.id,
            jsonb_build_object(
              'period', to_char(COALESCE(_r.current_period_end, now() + interval '30 days'), 'YYYY-MM-DD'),
              'plan_code', _r.plan_code, 'quota', _qty, 'months', _months, 'backfill', true));

    out_user_id := _r.user_id; credited := _total; RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_subscription_sms() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_subscription_sms() TO service_role;