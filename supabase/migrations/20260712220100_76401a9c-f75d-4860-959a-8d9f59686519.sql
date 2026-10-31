
-- ============================================================================
-- Renforcement retraits utilisateurs : verrou anti-concurrence + admin liste avancée
-- ============================================================================

-- 1) Verrou transactionnel par utilisateur : empêche deux demandes concurrentes
--    (couvre le cas où beneficiary_balances est vide, FOR UPDATE ne verrouille rien)
CREATE OR REPLACE FUNCTION public.request_user_withdrawal(
  _amount bigint,
  _method public.user_withdrawal_channel,
  _details jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Verrou transactionnel : sérialise toutes les demandes concurrentes du même user.
  -- 4242 = namespace applicatif retraits.
  PERFORM pg_advisory_xact_lock(4242, hashtextextended(v_uid::text, 0)::int);

  -- Verrou lignes existantes (si présentes) pour cohérence FIFO
  PERFORM 1 FROM public.beneficiary_balances WHERE user_id = v_uid FOR UPDATE;

  SELECT available_amount INTO v_available FROM public.get_my_wallet();

  IF v_available < _amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  INSERT INTO public.user_withdrawal_requests (user_id, amount, payment_method, payment_details, status)
  VALUES (v_uid, _amount, _method, _details, 'pending')
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.request_user_withdrawal(bigint, public.user_withdrawal_channel, jsonb) TO authenticated;

-- 2) admin_list_withdrawals_v2 : pagination + filtres + recherche
CREATE OR REPLACE FUNCTION public.admin_list_withdrawals_v2(
  _status public.user_withdrawal_status DEFAULT NULL,
  _method public.user_withdrawal_channel DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _search text DEFAULT NULL,
  _limit int DEFAULT 20,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  phone_number text,
  amount bigint,
  payment_method public.user_withdrawal_channel,
  payment_details jsonb,
  status public.user_withdrawal_status,
  rejection_reason text,
  processed_at timestamptz,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_search text := NULLIF(trim(coalesce(_search, '')), '');
  v_lim int := GREATEST(LEAST(coalesce(_limit, 20), 200), 1);
  v_off int := GREATEST(coalesce(_offset, 0), 0);
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT w.*, p.full_name AS pf_name, p.phone_number AS pf_phone
    FROM public.user_withdrawal_requests w
    LEFT JOIN public.profiles p ON p.id = w.user_id
    WHERE (_status IS NULL OR w.status = _status)
      AND (_method IS NULL OR w.payment_method = _method)
      AND (_from IS NULL OR w.created_at >= _from)
      AND (_to IS NULL OR w.created_at < _to)
      AND (
        v_search IS NULL
        OR w.user_id::text = v_search
        OR p.full_name ILIKE '%' || v_search || '%'
        OR p.phone_number ILIKE '%' || v_search || '%'
      )
  ), counted AS (
    SELECT (SELECT count(*) FROM base) AS c
  )
  SELECT b.id, b.user_id, b.pf_name, b.pf_phone, b.amount, b.payment_method,
         b.payment_details, b.status, b.rejection_reason, b.processed_at, b.created_at,
         (SELECT c FROM counted)
  FROM base b
  ORDER BY b.created_at DESC
  LIMIT v_lim OFFSET v_off;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_list_withdrawals_v2(
  public.user_withdrawal_status,
  public.user_withdrawal_channel,
  timestamptz, timestamptz, text, int, int
) TO authenticated;
