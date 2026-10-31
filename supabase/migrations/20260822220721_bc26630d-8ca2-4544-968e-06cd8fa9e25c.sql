-- 1. Portefeuille : distinguer inclus vs acheté
ALTER TABLE public.sms_wallets
  ADD COLUMN IF NOT EXISTS included_remaining integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_granted integer NOT NULL DEFAULT 0;

-- 2. Débit : consomme d'abord les SMS inclus
CREATE OR REPLACE FUNCTION public.sms_wallet_debit(
  _user_id uuid,
  _qty integer,
  _reason public.sms_ledger_reason,
  _ref_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new int;
  _from_included int;
BEGIN
  IF _qty IS NULL OR _qty <= 0 THEN
    RETURN NULL;
  END IF;

  UPDATE public.sms_wallets
     SET balance_remaining  = balance_remaining - _qty,
         included_remaining = GREATEST(included_remaining - _qty, 0),
         total_consumed     = total_consumed + _qty,
         updated_at         = now()
   WHERE user_id = _user_id
     AND balance_remaining >= _qty
   RETURNING balance_remaining, LEAST(_qty, included_remaining + _qty) INTO _new, _from_included;

  IF _new IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.sms_ledger(user_id, delta, reason, ref_id, metadata)
    VALUES (_user_id, -_qty, _reason, _ref_id, COALESCE(_metadata, '{}'::jsonb));

  RETURN _new;
END;
$$;

-- 3. Crédit "acheté" : inchangé fonctionnellement, mais ne touche pas le bucket inclus
CREATE OR REPLACE FUNCTION public.sms_wallet_credit(
  _user_id uuid,
  _qty integer,
  _reason public.sms_ledger_reason,
  _ref_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_bal int;
BEGIN
  IF _qty IS NULL OR _qty <= 0 THEN
    RAISE EXCEPTION 'invalid_qty';
  END IF;

  INSERT INTO public.sms_wallets (user_id, balance_remaining, total_purchased, total_consumed)
  VALUES (_user_id, _qty, _qty, 0)
  ON CONFLICT (user_id) DO UPDATE
     SET balance_remaining = public.sms_wallets.balance_remaining + EXCLUDED.balance_remaining,
         total_purchased   = public.sms_wallets.total_purchased   + EXCLUDED.total_purchased,
         updated_at        = now()
  RETURNING balance_remaining INTO _new_bal;

  INSERT INTO public.sms_ledger (user_id, delta, reason, ref_id, metadata)
  VALUES (_user_id, _qty, _reason, _ref_id, COALESCE(_metadata, '{}'::jsonb));

  RETURN _new_bal;
END;
$$;

-- 4. Octroi des SMS inclus pour une période d'abonnement (idempotent)
CREATE OR REPLACE FUNCTION public.grant_subscription_sms(_subscription_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sub public.user_subscriptions;
  _qty int;
  _period text;
  _old_included int := 0;
  _delta int;
BEGIN
  SELECT * INTO _sub FROM public.user_subscriptions WHERE id = _subscription_id;
  IF NOT FOUND OR _sub.status NOT IN ('active','trialing') THEN
    RETURN NULL;
  END IF;

  SELECT sms_included INTO _qty FROM public.subscription_plans WHERE code = _sub.plan_code;
  IF COALESCE(_qty, 0) <= 0 THEN
    RETURN NULL;
  END IF;

  _period := to_char(COALESCE(_sub.current_period_end, now() + interval '30 days'), 'YYYY-MM-DD');

  IF EXISTS (
    SELECT 1 FROM public.sms_ledger
     WHERE user_id = _sub.user_id
       AND reason = 'plan_grant'
       AND ref_id = _sub.id
       AND metadata->>'period' = _period
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.sms_wallets (user_id, balance_remaining, included_remaining, total_granted)
  VALUES (_sub.user_id, _qty, _qty, _qty)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT included_remaining INTO _old_included
    FROM public.sms_wallets WHERE user_id = _sub.user_id FOR UPDATE;

  _delta := _qty - COALESCE(_old_included, 0);

  UPDATE public.sms_wallets
     SET balance_remaining  = GREATEST(balance_remaining + _delta, 0),
         included_remaining = _qty,
         total_granted      = total_granted + GREATEST(_delta, 0),
         updated_at         = now()
   WHERE user_id = _sub.user_id;

  INSERT INTO public.sms_ledger (user_id, delta, reason, ref_id, metadata)
  VALUES (_sub.user_id, _delta, 'plan_grant', _sub.id,
          jsonb_build_object('period', _period, 'plan_code', _sub.plan_code, 'quota', _qty));

  RETURN _qty;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_subscription_sms(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_subscription_sms(uuid) TO service_role;

-- 5. Brancher l'octroi sur l'activation d'abonnement
CREATE OR REPLACE FUNCTION public.apply_subscription_webhook(
  _subscription_id uuid,
  _new_status text,
  _djomy_ref text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _mapped public.subscription_status;
  _uid uuid;
  _current public.subscription_status;
BEGIN
  SELECT user_id, status INTO _uid, _current
    FROM public.user_subscriptions
   WHERE id = _subscription_id
   FOR UPDATE;

  IF _uid IS NULL THEN
    RETURN;
  END IF;

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

  IF _current = _mapped THEN
    IF _djomy_ref IS NOT NULL THEN
      UPDATE public.user_subscriptions
         SET djomy_ref = COALESCE(djomy_ref, _djomy_ref)
       WHERE id = _subscription_id;
    END IF;
    IF _mapped = 'active' THEN
      PERFORM public.grant_subscription_sms(_subscription_id);
    END IF;
    RETURN;
  END IF;

  IF _mapped = 'pending' AND _current IN ('active','trialing','past_due','cancelled') THEN
    IF _djomy_ref IS NOT NULL THEN
      UPDATE public.user_subscriptions
         SET djomy_ref = COALESCE(djomy_ref, _djomy_ref)
       WHERE id = _subscription_id;
    END IF;
    RETURN;
  END IF;

  IF _mapped = 'active' THEN
    PERFORM 1
      FROM public.user_subscriptions
     WHERE user_id = _uid
       AND id <> _subscription_id
       AND status IN ('active','trialing','past_due')
     FOR UPDATE;

    UPDATE public.user_subscriptions
       SET status = 'cancelled',
           cancelled_at = COALESCE(cancelled_at, now()),
           updated_at = now()
     WHERE user_id = _uid
       AND id <> _subscription_id
       AND status IN ('active','trialing','past_due');
  END IF;

  UPDATE public.user_subscriptions
     SET status = _mapped,
         djomy_ref = COALESCE(_djomy_ref, djomy_ref),
         current_period_end = CASE WHEN _mapped = 'active'
                                   THEN COALESCE(current_period_end, now() + interval '30 days')
                                   ELSE current_period_end END,
         cancelled_at = CASE WHEN _mapped = 'cancelled' AND cancelled_at IS NULL
                             THEN now() ELSE cancelled_at END,
         updated_at = now()
   WHERE id = _subscription_id;

  IF _mapped = 'active' THEN
    PERFORM public.grant_subscription_sms(_subscription_id);
  END IF;
END;
$$;

-- 6. Rattrapage : un lot par mois facturé, pour les abonnés jamais crédités
CREATE OR REPLACE FUNCTION public.backfill_subscription_sms()
RETURNS TABLE(user_id uuid, credited integer)
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

    IF EXISTS (SELECT 1 FROM public.sms_ledger
                WHERE sms_ledger.user_id = _r.user_id AND reason = 'plan_grant') THEN
      CONTINUE;
    END IF;

    _months := GREATEST(1, ceil(EXTRACT(epoch FROM (now() - _r.created_at)) / 2592000.0)::int);
    _total  := _qty * _months;

    INSERT INTO public.sms_wallets (user_id, balance_remaining, included_remaining, total_granted)
    VALUES (_r.user_id, _total, _qty, _total)
    ON CONFLICT (user_id) DO UPDATE
       SET balance_remaining  = public.sms_wallets.balance_remaining + _total,
           included_remaining = GREATEST(public.sms_wallets.included_remaining, _qty),
           total_granted      = public.sms_wallets.total_granted + _total,
           updated_at         = now();

    INSERT INTO public.sms_ledger (user_id, delta, reason, ref_id, metadata)
    VALUES (_r.user_id, _total, 'plan_grant', _r.id,
            jsonb_build_object(
              'period', to_char(COALESCE(_r.current_period_end, now() + interval '30 days'), 'YYYY-MM-DD'),
              'plan_code', _r.plan_code, 'quota', _qty, 'months', _months, 'backfill', true));

    user_id := _r.user_id; credited := _total; RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_subscription_sms() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_subscription_sms() TO service_role;

-- 7. Exposer le solde SMS dans les droits utilisateur
CREATE OR REPLACE FUNCTION public.get_my_sms_balance()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'total', COALESCE(w.balance_remaining, 0),
    'included', COALESCE(w.included_remaining, 0),
    'purchased', GREATEST(COALESCE(w.balance_remaining,0) - COALESCE(w.included_remaining,0), 0),
    'total_granted', COALESCE(w.total_granted, 0),
    'total_purchased', COALESCE(w.total_purchased, 0),
    'total_consumed', COALESCE(w.total_consumed, 0)
  )
  FROM (SELECT auth.uid() AS uid) u
  LEFT JOIN public.sms_wallets w ON w.user_id = u.uid;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_sms_balance() TO authenticated;