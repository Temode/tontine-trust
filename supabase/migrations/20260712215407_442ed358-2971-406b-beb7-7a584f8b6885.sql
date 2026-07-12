
-- ============================================================================
-- Portefeuille utilisateur consolidé + retraits globaux (parallèle à withdrawal_requests)
-- ============================================================================

CREATE TYPE public.user_withdrawal_channel AS ENUM (
  'mobile_money_om',
  'mobile_money_momo',
  'card',
  'bank_transfer'
);

CREATE TYPE public.user_withdrawal_status AS ENUM (
  'pending',
  'completed',
  'rejected'
);

-- ----------------------------------------------------------------------------
-- Table user_withdrawal_requests
-- ----------------------------------------------------------------------------
CREATE TABLE public.user_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount bigint NOT NULL CHECK (amount > 0),
  payment_method public.user_withdrawal_channel NOT NULL,
  payment_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.user_withdrawal_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  processed_by uuid REFERENCES auth.users(id),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_withdrawal_requests_user ON public.user_withdrawal_requests(user_id, created_at DESC);
CREATE INDEX idx_user_withdrawal_requests_status ON public.user_withdrawal_requests(status, created_at DESC);

GRANT SELECT, INSERT ON public.user_withdrawal_requests TO authenticated;
GRANT ALL ON public.user_withdrawal_requests TO service_role;

ALTER TABLE public.user_withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_withdrawal_owner_select"
  ON public.user_withdrawal_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "user_withdrawal_owner_insert"
  ON public.user_withdrawal_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_withdrawal_admin_update"
  ON public.user_withdrawal_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_user_withdrawal_touch() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_user_withdrawal_touch BEFORE UPDATE ON public.user_withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_user_withdrawal_touch();

-- ----------------------------------------------------------------------------
-- RPC: get_my_wallet
--   Agrège beneficiary_balances - retraits pending pour donner
--   { available, locked, total_credited, total_withdrawn }
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_wallet()
RETURNS TABLE (
  available_amount bigint,
  locked_amount bigint,
  total_credited bigint,
  total_withdrawn bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_credited bigint;
  v_group_withdrawn bigint;
  v_pending_global bigint;
  v_completed_global bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT
    COALESCE(SUM(bb.total_credited), 0),
    COALESCE(SUM(bb.total_withdrawn), 0)
  INTO v_credited, v_group_withdrawn
  FROM public.beneficiary_balances bb
  WHERE bb.user_id = v_uid;

  SELECT COALESCE(SUM(amount), 0) INTO v_pending_global
  FROM public.user_withdrawal_requests
  WHERE user_id = v_uid AND status = 'pending';

  SELECT COALESCE(SUM(amount), 0) INTO v_completed_global
  FROM public.user_withdrawal_requests
  WHERE user_id = v_uid AND status = 'completed';

  RETURN QUERY SELECT
    GREATEST(v_credited - v_group_withdrawn - v_completed_global - v_pending_global, 0)::bigint AS available_amount,
    v_pending_global::bigint AS locked_amount,
    v_credited::bigint AS total_credited,
    (v_group_withdrawn + v_completed_global)::bigint AS total_withdrawn;
END $$;

GRANT EXECUTE ON FUNCTION public.get_my_wallet() TO authenticated;

-- ----------------------------------------------------------------------------
-- RPC: request_user_withdrawal
-- ----------------------------------------------------------------------------
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

  -- Validation payload par méthode
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

  -- Verrou logique sur les balances du user pour éviter double-débit concurrent
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

-- ----------------------------------------------------------------------------
-- RPC: admin_mark_withdrawal_paid
--   Marque completed + décrémente FIFO les beneficiary_balances de l'utilisateur.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_mark_withdrawal_paid(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_wr public.user_withdrawal_requests%ROWTYPE;
  v_remaining bigint;
  v_bb RECORD;
  v_take bigint;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_wr FROM public.user_withdrawal_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF v_wr.status <> 'pending' THEN
    RAISE EXCEPTION 'INVALID_STATE:%', v_wr.status;
  END IF;

  v_remaining := v_wr.amount;

  FOR v_bb IN
    SELECT id, available_amount
    FROM public.beneficiary_balances
    WHERE user_id = v_wr.user_id AND available_amount > 0
    ORDER BY updated_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_bb.available_amount, v_remaining);
    UPDATE public.beneficiary_balances
      SET available_amount = available_amount - v_take,
          total_withdrawn = total_withdrawn + v_take,
          updated_at = now()
      WHERE id = v_bb.id;
    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE_ON_COMPLETE';
  END IF;

  UPDATE public.user_withdrawal_requests
     SET status = 'completed', processed_by = v_uid, processed_at = now()
   WHERE id = _id;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_mark_withdrawal_paid(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- RPC: admin_reject_withdrawal
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN
    RAISE EXCEPTION 'REASON_REQUIRED';
  END IF;

  UPDATE public.user_withdrawal_requests
     SET status = 'rejected',
         rejection_reason = _reason,
         processed_by = v_uid,
         processed_at = now()
   WHERE id = _id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND_OR_INVALID_STATE';
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_reject_withdrawal(uuid, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- RPC: admin_list_withdrawals — retourne les demandes enrichies (user info)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_withdrawals(_status public.user_withdrawal_status DEFAULT NULL)
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
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
    SELECT w.id, w.user_id, p.full_name, p.phone_number,
           w.amount, w.payment_method, w.payment_details, w.status,
           w.rejection_reason, w.processed_at, w.created_at
    FROM public.user_withdrawal_requests w
    LEFT JOIN public.profiles p ON p.id = w.user_id
    WHERE (_status IS NULL OR w.status = _status)
    ORDER BY w.created_at DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_list_withdrawals(public.user_withdrawal_status) TO authenticated;
