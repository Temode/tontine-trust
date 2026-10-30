
-- Whitelist of notification kinds eligible for SMS delivery (paid plans + credit only)
CREATE OR REPLACE FUNCTION public.notification_kind_is_sms_critical(_kind public.notification_kind)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _kind IN (
    'contribution_due',
    'contribution_late',
    'contribution_defaulted',
    'payout_released',
    'payment_confirmed_by_admin',
    'payment_rejected_by_admin',
    'withdrawal_paid',
    'withdrawal_failed',
    'group_deletion_pending_admin',
    'dispute_raised',
    'cycle_started'
  );
$$;

REVOKE ALL ON FUNCTION public.notification_kind_is_sms_critical(public.notification_kind) FROM public;
GRANT EXECUTE ON FUNCTION public.notification_kind_is_sms_critical(public.notification_kind) TO authenticated, service_role;

-- Atomic wallet decrement (returns new balance, or NULL if insufficient / no wallet)
CREATE OR REPLACE FUNCTION public.sms_wallet_debit(_user_id uuid, _qty int, _reason public.sms_ledger_reason, _ref_id uuid, _metadata jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new int;
BEGIN
  UPDATE public.sms_wallets
     SET balance_remaining = balance_remaining - _qty,
         total_consumed    = total_consumed + _qty,
         updated_at        = now()
   WHERE user_id = _user_id
     AND balance_remaining >= _qty
   RETURNING balance_remaining INTO _new;

  IF _new IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.sms_ledger(user_id, delta, reason, ref_id, metadata)
    VALUES (_user_id, -_qty, _reason, _ref_id, COALESCE(_metadata, '{}'::jsonb));

  RETURN _new;
END;
$$;

REVOKE ALL ON FUNCTION public.sms_wallet_debit(uuid, int, public.sms_ledger_reason, uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.sms_wallet_debit(uuid, int, public.sms_ledger_reason, uuid, jsonb) TO service_role;

-- Central dispatcher: In-App (always) + Email (queued if templates present) + SMS (paid plans + credit + critical kinds)
CREATE OR REPLACE FUNCTION public.dispatch_notification(
  _user_id  uuid,
  _kind     public.notification_kind,
  _title    text,
  _body     text        DEFAULT NULL,
  _data     jsonb       DEFAULT '{}'::jsonb,
  _group_id uuid        DEFAULT NULL,
  _link     text        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _notif_id      uuid;
  _sub           public.user_subscriptions;
  _plan_paid     boolean := false;
  _sms_eligible  boolean := false;
  _phone         text;
  _wallet_bal    int;
  _new_bal       int;
  _sms_sent      boolean := false;
  _sms_skipped   text := NULL;
  _dedupe        text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'dispatch_notification: user_id required';
  END IF;

  -- 1) In-App: always
  INSERT INTO public.notifications(user_id, kind, title, body, group_id, data, link)
    VALUES (_user_id, _kind, _title, _body, _group_id, COALESCE(_data, '{}'::jsonb), _link)
    RETURNING id INTO _notif_id;

  -- 2) Determine active paid plan
  SELECT * INTO _sub
    FROM public.user_subscriptions
   WHERE user_id = _user_id
   ORDER BY updated_at DESC
   LIMIT 1;

  IF FOUND
     AND _sub.status IN ('active','trialing')
     AND _sub.plan_code IN ('premium','business') THEN
    _plan_paid := true;
  END IF;

  -- 3) SMS routing: paid plan + critical kind + wallet balance > 0
  IF _plan_paid AND public.notification_kind_is_sms_critical(_kind) THEN
    SELECT phone_number INTO _phone FROM public.profiles WHERE id = _user_id;
    SELECT balance_remaining INTO _wallet_bal FROM public.sms_wallets WHERE user_id = _user_id;

    IF _phone IS NULL OR length(trim(_phone)) < 6 THEN
      _sms_skipped := 'no_phone';
    ELSIF _wallet_bal IS NULL OR _wallet_bal <= 0 THEN
      _sms_skipped := 'wallet_empty';
      -- Nudge the user: only once per user per calendar day
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications
         WHERE user_id = _user_id
           AND kind = 'system'
           AND (data ->> 'reason') = 'sms_wallet_empty'
           AND created_at::date = current_date
      ) THEN
        INSERT INTO public.notifications(user_id, kind, title, body, data, link)
          VALUES (
            _user_id,
            'system',
            'Forfait SMS épuisé',
            'Votre forfait SMS est à 0. Rechargez depuis un de vos groupes pour continuer à recevoir les alertes critiques par SMS.',
            jsonb_build_object('reason','sms_wallet_empty'),
            '/profil'
          );
      END IF;
    ELSE
      _dedupe := format('notif:%s:%s', _kind::text, _notif_id::text);
      _new_bal := public.sms_wallet_debit(
        _user_id, 1, 'consumption'::public.sms_ledger_reason, _notif_id,
        jsonb_build_object('kind', _kind, 'group_id', _group_id)
      );
      IF _new_bal IS NOT NULL THEN
        INSERT INTO public.sms_outbox(kind, payload, dedupe_key, status)
          VALUES (
            _kind::text,
            jsonb_build_object(
              'user_id',      _user_id,
              'phone',        _phone,
              'title',        _title,
              'body',         COALESCE(_body, _title),
              'group_id',     _group_id,
              'notification_id', _notif_id,
              'data',         COALESCE(_data, '{}'::jsonb)
            ),
            _dedupe,
            'pending'
          )
          ON CONFLICT (dedupe_key) DO NOTHING;
        _sms_sent := true;
      ELSE
        _sms_skipped := 'debit_failed';
      END IF;
    END IF;
  ELSIF NOT _plan_paid THEN
    _sms_skipped := 'plan_free';
  ELSE
    _sms_skipped := 'kind_not_critical';
  END IF;

  RETURN jsonb_build_object(
    'notification_id', _notif_id,
    'in_app',          true,
    'plan_paid',       _plan_paid,
    'sms_sent',        _sms_sent,
    'sms_skipped',     _sms_skipped,
    'wallet_balance',  COALESCE(_new_bal, _wallet_bal)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_notification(uuid, public.notification_kind, text, text, jsonb, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.dispatch_notification(uuid, public.notification_kind, text, text, jsonb, uuid, text) TO service_role;
