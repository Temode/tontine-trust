-- Verrou retrait : caution exigée et non payée -> blocage
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _group_id uuid,
  _amount bigint,
  _method public.withdrawal_method,
  _destination text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance bigint;
  v_id uuid;
  v_dep_status text;
  v_dep_required boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  SELECT g.deposit_required, gm.deposit_status
    INTO v_dep_required, v_dep_status
  FROM public.group_members gm
  JOIN public.groups g ON g.id = gm.group_id
  WHERE gm.group_id = _group_id AND gm.user_id = v_user;

  IF v_dep_required AND v_dep_status IS NOT NULL
     AND v_dep_status NOT IN ('paid','refunded','not_required') THEN
    RAISE EXCEPTION 'DEPOSIT_REQUIRED';
  END IF;

  SELECT available_amount INTO v_balance
  FROM public.beneficiary_balances
  WHERE user_id = v_user AND group_id = _group_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < _amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  UPDATE public.beneficiary_balances
    SET available_amount = available_amount - _amount,
        total_withdrawn = total_withdrawn + _amount,
        updated_at = now()
    WHERE user_id = v_user AND group_id = _group_id;

  INSERT INTO public.withdrawal_requests (user_id, group_id, amount, method, destination, status)
  VALUES (v_user, _group_id, _amount, _method, _destination, 'pending')
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_user_id, group_id, action, entity_type, entity_id, metadata)
  VALUES (v_user, _group_id, 'withdrawal_requested', 'withdrawal_request', v_id,
    jsonb_build_object('amount', _amount, 'method', _method));

  RETURN v_id;
END; $$;

-- Forçage admin
CREATE OR REPLACE FUNCTION public.admin_force_deposit_status(
  _deposit_id uuid,
  _new_status text,
  _reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_dep record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 10 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  IF _new_status NOT IN ('pending','paid','failed','cancelled') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  SELECT * INTO v_dep FROM public.member_deposits WHERE id = _deposit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEPOSIT_NOT_FOUND'; END IF;

  IF NOT public.is_group_organizer(v_dep.group_id, v_user)
     AND NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.member_deposits
    SET status = _new_status,
        paid_at = CASE WHEN _new_status='paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
        updated_at = now()
    WHERE id = _deposit_id;

  IF _new_status = 'paid' THEN
    UPDATE public.group_members SET deposit_status = 'paid'
      WHERE group_id = v_dep.group_id AND user_id = v_dep.user_id;
  ELSIF _new_status IN ('failed','cancelled') THEN
    UPDATE public.group_members SET deposit_status = 'pending'
      WHERE group_id = v_dep.group_id AND user_id = v_dep.user_id
        AND deposit_status NOT IN ('paid','refunded');
  END IF;

  INSERT INTO public.audit_log (actor_user_id, group_id, action, entity_type, entity_id, metadata)
  VALUES (v_user, v_dep.group_id, 'deposit_forced', 'member_deposit', _deposit_id,
    jsonb_build_object('new_status', _new_status, 'reason', _reason,
                       'previous_status', v_dep.status,
                       'target_user', v_dep.user_id));
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_force_deposit_status(uuid, text, text) TO authenticated;

-- Listing admin enrichi
CREATE OR REPLACE FUNCTION public.admin_list_deposits(
  _status text DEFAULT NULL,
  _group_id uuid DEFAULT NULL,
  _limit int DEFAULT 200
) RETURNS TABLE (
  deposit_id uuid,
  group_id uuid,
  group_name text,
  user_id uuid,
  user_full_name text,
  user_phone text,
  amount bigint,
  months smallint,
  status text,
  payment_method text,
  djomy_transaction_id text,
  paid_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  member_deposit_status text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
  SELECT d.id, d.group_id, g.name,
         d.user_id, p.full_name, p.phone_number,
         d.amount, d.months, d.status, d.payment_method,
         d.djomy_transaction_id, d.paid_at, d.created_at, d.updated_at,
         gm.deposit_status
  FROM public.member_deposits d
  JOIN public.groups g ON g.id = d.group_id
  LEFT JOIN public.profiles p ON p.id = d.user_id
  LEFT JOIN public.group_members gm
    ON gm.group_id = d.group_id AND gm.user_id = d.user_id
  WHERE (_status IS NULL OR d.status = _status)
    AND (_group_id IS NULL OR d.group_id = _group_id)
  ORDER BY d.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_list_deposits(text, uuid, int) TO authenticated;

-- Position + verrou pour un membre
CREATE OR REPLACE FUNCTION public.get_member_position_info(
  _group_id uuid,
  _user_id uuid DEFAULT NULL
) RETURNS TABLE (
  user_id uuid,
  member_position int,
  total_active int,
  max_members int,
  last_third_start int,
  is_in_last_third boolean,
  joined_after_start boolean,
  deposit_required boolean,
  deposit_status text,
  withdrawal_locked boolean,
  lock_reason text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target uuid := COALESCE(_user_id, auth.uid());
  v_max int; v_dep_required boolean; v_lock_last_third boolean;
  v_total int; v_last_third int;
  v_pos int; v_jas boolean; v_dep_status text;
  v_locked boolean := false; v_reason text := NULL;
BEGIN
  IF v_target IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF v_target <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT public.is_group_organizer(_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT g.max_members, g.deposit_required, g.new_member_lock_last_third
    INTO v_max, v_dep_required, v_lock_last_third
    FROM public.groups g WHERE g.id = _group_id;

  SELECT COUNT(*) INTO v_total FROM public.group_members
    WHERE group_id = _group_id AND status='active';

  v_last_third := CEIL(COALESCE(v_max,0) * 2.0 / 3.0)::int + 1;

  SELECT gm.position, gm.joined_after_start, gm.deposit_status
    INTO v_pos, v_jas, v_dep_status
    FROM public.group_members gm
    WHERE gm.group_id = _group_id AND gm.user_id = v_target;

  IF v_dep_required AND v_dep_status IS NOT NULL
     AND v_dep_status NOT IN ('paid','refunded','not_required') THEN
    v_locked := true;
    v_reason := 'DEPOSIT_REQUIRED';
  END IF;

  RETURN QUERY SELECT v_target, v_pos, v_total, COALESCE(v_max,0),
    v_last_third,
    (v_pos IS NOT NULL AND v_pos >= v_last_third),
    COALESCE(v_jas,false),
    COALESCE(v_dep_required,false),
    v_dep_status,
    v_locked,
    v_reason;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_member_position_info(uuid, uuid) TO authenticated;