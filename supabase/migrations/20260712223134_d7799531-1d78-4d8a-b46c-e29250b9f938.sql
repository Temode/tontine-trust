CREATE OR REPLACE FUNCTION public.request_user_withdrawal(_amount bigint, _method user_withdrawal_channel, _details jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_available bigint;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF _method IN ('mobile_money_om', 'mobile_money_momo') THEN
    IF NOT (_details ? 'phone') OR length(trim(_details->>'phone')) < 8 THEN
      RAISE EXCEPTION 'INVALID_PHONE';
    END IF;
    IF NOT (_details ? 'phone_confirm') OR _details->>'phone' <> _details->>'phone_confirm' THEN
      RAISE EXCEPTION 'PHONE_MISMATCH';
    END IF;
  ELSIF _method = 'card' THEN
    IF NOT (_details ? 'cardholder_name') OR length(trim(_details->>'cardholder_name')) = 0 THEN
      RAISE EXCEPTION 'INVALID_CARDHOLDER';
    END IF;
    IF NOT (_details ? 'card_number') OR length(regexp_replace(_details->>'card_number', '\s', '', 'g')) < 12 THEN
      RAISE EXCEPTION 'INVALID_CARD_NUMBER';
    END IF;
  ELSIF _method = 'bank_transfer' THEN
    IF NOT (_details ? 'bank_name') OR length(trim(_details->>'bank_name')) = 0 THEN
      RAISE EXCEPTION 'INVALID_BANK_NAME';
    END IF;
    IF NOT (_details ? 'account_number') OR length(trim(_details->>'account_number')) < 5 THEN
      RAISE EXCEPTION 'INVALID_ACCOUNT_NUMBER';
    END IF;
    IF NOT (_details ? 'account_holder') OR length(trim(_details->>'account_holder')) = 0 THEN
      RAISE EXCEPTION 'INVALID_ACCOUNT_HOLDER';
    END IF;
  END IF;

  -- Verrou transactionnel bigint (évite l'overflow int du cast précédent).
  PERFORM pg_advisory_xact_lock(hashtextextended('user_withdrawal:' || v_uid::text, 0));

  PERFORM 1 FROM public.beneficiary_balances WHERE user_id = v_uid FOR UPDATE;

  SELECT available_amount INTO v_available FROM public.get_my_wallet();

  IF v_available < _amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  INSERT INTO public.user_withdrawal_requests (user_id, amount, payment_method, payment_details, status)
  VALUES (v_uid, _amount, _method, _details, 'pending')
  RETURNING id INTO v_id;

  RETURN v_id;
END $function$;