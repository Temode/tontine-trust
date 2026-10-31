-- =====================================================================
-- VOLET 1 : journal comptable plateforme
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.platform_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compartment text NOT NULL CHECK (compartment IN ('client_escrow','platform_revenue')),
  category text NOT NULL CHECK (category IN ('contribution','payout','sms_pack','subscription','withdrawal_fee','coordinator_fee','refund','adjustment')),
  direction text NOT NULL CHECK (direction IN ('in','out')),
  amount bigint NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'GNF',
  user_id uuid,
  group_id uuid,
  payment_id uuid,
  sms_order_id uuid,
  subscription_id uuid,
  withdrawal_id uuid,
  memo text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_ledger_created_idx ON public.platform_ledger (created_at DESC);
CREATE INDEX IF NOT EXISTS platform_ledger_comp_cat_idx ON public.platform_ledger (compartment, category, created_at DESC);

GRANT SELECT ON public.platform_ledger TO authenticated;
GRANT ALL ON public.platform_ledger TO service_role;
ALTER TABLE public.platform_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_ledger_super_admin_read" ON public.platform_ledger;
CREATE POLICY "platform_ledger_super_admin_read" ON public.platform_ledger
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.record_platform_entry(
  _compartment text, _category text, _direction text, _amount bigint,
  _idempotency_key text,
  _user_id uuid DEFAULT NULL, _group_id uuid DEFAULT NULL,
  _payment_id uuid DEFAULT NULL, _sms_order_id uuid DEFAULT NULL,
  _subscription_id uuid DEFAULT NULL, _withdrawal_id uuid DEFAULT NULL,
  _memo text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.platform_ledger (
    compartment, category, direction, amount, idempotency_key,
    user_id, group_id, payment_id, sms_order_id, subscription_id, withdrawal_id, memo
  ) VALUES (
    _compartment, _category, _direction, _amount, _idempotency_key,
    _user_id, _group_id, _payment_id, _sms_order_id, _subscription_id, _withdrawal_id, _memo
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
END; $$;

-- =====================================================================
-- Frais de retrait paramétrables
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.withdrawal_fee_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  percent numeric(6,3) NOT NULL DEFAULT 0 CHECK (percent >= 0 AND percent <= 100),
  min_fee bigint NOT NULL DEFAULT 0 CHECK (min_fee >= 0),
  max_fee bigint CHECK (max_fee IS NULL OR max_fee >= 0),
  is_active boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.withdrawal_fee_config TO authenticated;
GRANT ALL ON public.withdrawal_fee_config TO service_role;
ALTER TABLE public.withdrawal_fee_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawal_fee_config_read" ON public.withdrawal_fee_config;
CREATE POLICY "withdrawal_fee_config_read" ON public.withdrawal_fee_config
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.withdrawal_fee_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.compute_withdrawal_fee(_amount bigint)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.withdrawal_fee_config%ROWTYPE; f bigint;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN 0; END IF;
  SELECT * INTO c FROM public.withdrawal_fee_config WHERE id;
  IF NOT FOUND OR NOT c.is_active THEN RETURN 0; END IF;
  f := floor(_amount * c.percent / 100.0)::bigint;
  IF f < c.min_fee THEN f := c.min_fee; END IF;
  IF c.max_fee IS NOT NULL AND f > c.max_fee THEN f := c.max_fee; END IF;
  IF f > _amount THEN f := _amount; END IF;
  RETURN f;
END; $$;
GRANT EXECUTE ON FUNCTION public.compute_withdrawal_fee(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_withdrawal_fee_config(
  _percent numeric, _min_fee bigint, _max_fee bigint, _is_active boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'super_admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  UPDATE public.withdrawal_fee_config
     SET percent = COALESCE(_percent, 0),
         min_fee = COALESCE(_min_fee, 0),
         max_fee = _max_fee,
         is_active = COALESCE(_is_active, false),
         updated_by = v_uid,
         updated_at = now()
   WHERE id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_withdrawal_fee_config(numeric, bigint, bigint, boolean) TO authenticated;

ALTER TABLE public.user_withdrawal_requests
  ADD COLUMN IF NOT EXISTS fee_amount bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount bigint;

UPDATE public.user_withdrawal_requests SET net_amount = amount WHERE net_amount IS NULL;

-- =====================================================================
-- Rapports comptables admin
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_treasury_summary()
RETURNS TABLE (
  compartment text, category text,
  total_in bigint, total_out bigint, net bigint, net_30d bigint
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
  SELECT pl.compartment, pl.category,
    COALESCE(SUM(pl.amount) FILTER (WHERE pl.direction = 'in'), 0)::bigint,
    COALESCE(SUM(pl.amount) FILTER (WHERE pl.direction = 'out'), 0)::bigint,
    (COALESCE(SUM(pl.amount) FILTER (WHERE pl.direction = 'in'), 0)
     - COALESCE(SUM(pl.amount) FILTER (WHERE pl.direction = 'out'), 0))::bigint,
    (COALESCE(SUM(pl.amount) FILTER (WHERE pl.direction = 'in' AND pl.created_at > now() - interval '30 days'), 0)
     - COALESCE(SUM(pl.amount) FILTER (WHERE pl.direction = 'out' AND pl.created_at > now() - interval '30 days'), 0))::bigint
  FROM public.platform_ledger pl
  GROUP BY pl.compartment, pl.category
  ORDER BY pl.compartment, pl.category;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_treasury_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_treasury_journal(
  _compartment text DEFAULT NULL, _category text DEFAULT NULL,
  _from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL,
  _search text DEFAULT NULL, _limit int DEFAULT 50, _offset int DEFAULT 0
) RETURNS TABLE (
  id uuid, compartment text, category text, direction text, amount bigint,
  memo text, created_at timestamptz,
  user_id uuid, user_name text, group_id uuid, group_name text,
  total_count bigint
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
  WITH base AS (
    SELECT pl.*, p.full_name AS uname, g.name AS gname
    FROM public.platform_ledger pl
    LEFT JOIN public.profiles p ON p.id = pl.user_id
    LEFT JOIN public.groups g ON g.id = pl.group_id
    WHERE (_compartment IS NULL OR pl.compartment = _compartment)
      AND (_category IS NULL OR pl.category = _category)
      AND (_from IS NULL OR pl.created_at >= _from)
      AND (_to IS NULL OR pl.created_at <= _to)
      AND (_search IS NULL OR _search = '' OR p.full_name ILIKE '%'||_search||'%'
           OR g.name ILIKE '%'||_search||'%' OR pl.memo ILIKE '%'||_search||'%')
  )
  SELECT b.id, b.compartment, b.category, b.direction, b.amount, b.memo, b.created_at,
         b.user_id, b.uname, b.group_id, b.gname,
         (SELECT count(*) FROM base)::bigint
  FROM base b
  ORDER BY b.created_at DESC
  LIMIT COALESCE(_limit, 50) OFFSET COALESCE(_offset, 0);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_treasury_journal(text, text, timestamptz, timestamptz, text, int, int) TO authenticated;

-- =====================================================================
-- VOLET 2 : redistribution des pénalités
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.penalty_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid NOT NULL REFERENCES public.contributions(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  beneficiary_user_id uuid NOT NULL,
  amount bigint NOT NULL CHECK (amount >= 0),
  reverted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contribution_id, beneficiary_user_id)
);

CREATE INDEX IF NOT EXISTS penalty_distributions_user_idx
  ON public.penalty_distributions (beneficiary_user_id, created_at DESC);

GRANT SELECT ON public.penalty_distributions TO authenticated;
GRANT ALL ON public.penalty_distributions TO service_role;
ALTER TABLE public.penalty_distributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "penalty_distributions_read" ON public.penalty_distributions;
CREATE POLICY "penalty_distributions_read" ON public.penalty_distributions
  FOR SELECT TO authenticated
  USING (beneficiary_user_id = auth.uid()
         OR public.is_group_member(group_id, auth.uid())
         OR public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.distribute_penalty(_contribution_id uuid, _notify boolean DEFAULT true)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_c public.contributions%ROWTYPE;
  v_group public.groups%ROWTYPE;
  v_members uuid[];
  v_n int;
  v_base bigint;
  v_rest bigint;
  v_share bigint;
  v_uid uuid;
  v_i int := 0;
  v_total bigint := 0;
BEGIN
  SELECT * INTO v_c FROM public.contributions WHERE id = _contribution_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF COALESCE(v_c.penalty_amount, 0) <= 0 THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.penalty_distributions
              WHERE contribution_id = _contribution_id AND reverted_at IS NULL) THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = v_c.group_id;

  SELECT array_agg(gm.user_id ORDER BY gm.joined_at, gm.user_id)
    INTO v_members
    FROM public.group_members gm
   WHERE gm.group_id = v_c.group_id
     AND gm.status = 'active'::public.member_status;

  v_n := COALESCE(array_length(v_members, 1), 0);
  IF v_n = 0 THEN RETURN 0; END IF;

  v_base := v_c.penalty_amount / v_n;
  v_rest := v_c.penalty_amount - (v_base * v_n);

  FOREACH v_uid IN ARRAY v_members LOOP
    v_i := v_i + 1;
    v_share := v_base + CASE WHEN v_i <= v_rest THEN 1 ELSE 0 END;
    IF v_share <= 0 THEN CONTINUE; END IF;

    INSERT INTO public.beneficiary_balances (user_id, group_id, available_amount, total_credited)
    VALUES (v_uid, v_c.group_id, v_share, v_share)
    ON CONFLICT (user_id, group_id) DO UPDATE
      SET available_amount = public.beneficiary_balances.available_amount + EXCLUDED.available_amount,
          total_credited = public.beneficiary_balances.total_credited + EXCLUDED.total_credited,
          updated_at = now();

    INSERT INTO public.penalty_distributions (contribution_id, group_id, beneficiary_user_id, amount)
    VALUES (_contribution_id, v_c.group_id, v_uid, v_share)
    ON CONFLICT (contribution_id, beneficiary_user_id) DO UPDATE
      SET amount = EXCLUDED.amount, reverted_at = NULL, created_at = now();

    v_total := v_total + v_share;

    IF _notify THEN
      PERFORM public.dispatch_notification(
        v_uid,
        'penalty_share_received'::public.notification_kind,
        'Part de pénalité reçue',
        format('Vous avez reçu %s GNF issus d''une pénalité de retard dans le groupe %s.',
               v_share, COALESCE(v_group.name, '—')),
        jsonb_build_object('contribution_id', _contribution_id, 'amount', v_share),
        v_c.group_id,
        '/mon-solde'
      );
    END IF;
  END LOOP;

  UPDATE public.contributions
     SET penalty_collected_at = COALESCE(penalty_collected_at, now())
   WHERE id = _contribution_id;

  RETURN v_total;
END; $$;
GRANT EXECUTE ON FUNCTION public.distribute_penalty(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.revert_penalty_distribution(_contribution_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_total bigint := 0;
BEGIN
  FOR r IN SELECT * FROM public.penalty_distributions
            WHERE contribution_id = _contribution_id AND reverted_at IS NULL FOR UPDATE
  LOOP
    UPDATE public.beneficiary_balances
       SET available_amount = GREATEST(available_amount - r.amount, 0),
           total_credited = GREATEST(total_credited - r.amount, 0),
           updated_at = now()
     WHERE user_id = r.beneficiary_user_id AND group_id = r.group_id;

    UPDATE public.penalty_distributions SET reverted_at = now() WHERE id = r.id;
    v_total := v_total + r.amount;
  END LOOP;
  RETURN v_total;
END; $$;
GRANT EXECUTE ON FUNCTION public.revert_penalty_distribution(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- Câblage : pénalités redistribuées + journal comptable
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.waive_penalty(_contribution_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_c public.contributions%ROWTYPE;
  v_old bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_c FROM public.contributions WHERE id = _contribution_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTRIBUTION_NOT_FOUND'; END IF;
  IF NOT public.has_admin_permission(v_c.group_id, v_uid, 'can_waive_penalty') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF COALESCE(v_c.penalty_amount, 0) = 0 THEN RAISE EXCEPTION 'NO_PENALTY'; END IF;

  v_old := v_c.penalty_amount;
  PERFORM public.revert_penalty_distribution(_contribution_id);

  UPDATE public.contributions SET
    penalty_amount = 0,
    penalty_collected_at = NULL,
    penalty_waived_at = now(),
    penalty_waived_by = v_uid,
    penalty_waive_reason = _reason
  WHERE id = _contribution_id;

  INSERT INTO public.notifications (user_id, kind, title, body, group_id, data)
  VALUES (v_c.payer_user_id, 'penalty_waived',
    'Pénalité annulée',
    COALESCE(_reason, 'Un administrateur a annulé votre pénalité de retard.'),
    v_c.group_id, jsonb_build_object('contribution_id', _contribution_id, 'amount', v_old));

  PERFORM public.log_audit(
    v_c.group_id, 'penalty_waived', 'contribution', _contribution_id,
    jsonb_build_object('amount', v_old, 'reason', _reason)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.adjust_penalty(
  _contribution_id uuid, _new_amount bigint, _reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_c public.contributions%ROWTYPE;
  v_old bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _new_amount IS NULL OR _new_amount < 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  SELECT * INTO v_c FROM public.contributions WHERE id = _contribution_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTRIBUTION_NOT_FOUND'; END IF;
  IF NOT public.has_admin_permission(v_c.group_id, v_uid, 'can_waive_penalty') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  v_old := COALESCE(v_c.penalty_amount, 0);
  PERFORM public.revert_penalty_distribution(_contribution_id);

  UPDATE public.contributions SET
    penalty_amount = _new_amount,
    penalty_collected_at = NULL,
    penalty_adjusted_from = v_old,
    penalty_adjusted_by = v_uid,
    penalty_adjusted_at = now(),
    penalty_adjust_reason = _reason
  WHERE id = _contribution_id;

  IF _new_amount > 0 THEN
    PERFORM public.distribute_penalty(_contribution_id, true);
  END IF;

  INSERT INTO public.notifications (user_id, kind, title, body, group_id, data)
  VALUES (v_c.payer_user_id, 'penalty_adjusted',
    'Pénalité ajustée',
    COALESCE(_reason, 'Le montant de votre pénalité a été ajusté.'),
    v_c.group_id,
    jsonb_build_object('contribution_id', _contribution_id, 'from', v_old, 'to', _new_amount));

  PERFORM public.log_audit(
    v_c.group_id, 'penalty_adjusted', 'contribution', _contribution_id,
    jsonb_build_object('from', v_old, 'to', _new_amount, 'reason', _reason)
  );
END; $$;
