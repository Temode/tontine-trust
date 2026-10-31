-- 1) Neutraliser la RPC legacy de retrait "par groupe"
CREATE OR REPLACE FUNCTION public.request_withdrawal(_group_id uuid, _amount bigint, _method withdrawal_method, _destination text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'DEPRECATED_USE_GLOBAL_WITHDRAWAL'
    USING HINT = 'Utilisez request_user_withdrawal (portefeuille consolidé).';
END $$;

REVOKE ALL ON FUNCTION public.request_withdrawal(uuid, bigint, withdrawal_method, text) FROM PUBLIC, anon, authenticated;

-- 2) Trigger guard : bloque toute augmentation de total_withdrawn hors flux officiel
CREATE OR REPLACE FUNCTION public.guard_beneficiary_balances_withdrawn()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_marker text;
BEGIN
  IF NEW.total_withdrawn > OLD.total_withdrawn THEN
    -- marqueur transactionnel posé par admin_mark_withdrawal_paid
    v_marker := current_setting('app.withdrawal_ctx', true);
    IF v_marker IS NULL OR v_marker = '' THEN
      RAISE EXCEPTION 'FORBIDDEN_BALANCE_MUTATION'
        USING HINT = 'total_withdrawn ne peut augmenter qu''via admin_mark_withdrawal_paid.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_bb_withdrawn ON public.beneficiary_balances;
CREATE TRIGGER trg_guard_bb_withdrawn
  BEFORE UPDATE ON public.beneficiary_balances
  FOR EACH ROW EXECUTE FUNCTION public.guard_beneficiary_balances_withdrawn();

-- 3) Poser le marqueur dans admin_mark_withdrawal_paid (et vérifier l'existence d'une demande)
CREATE OR REPLACE FUNCTION public.admin_mark_withdrawal_paid(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_wr.status <> 'pending' THEN RAISE EXCEPTION 'INVALID_STATE:%', v_wr.status; END IF;

  -- Marqueur transactionnel autorisant l'écriture sur beneficiary_balances
  PERFORM set_config('app.withdrawal_ctx', _id::text, true);

  v_remaining := v_wr.amount;
  FOR v_bb IN
    SELECT id, available_amount FROM public.beneficiary_balances
    WHERE user_id = v_wr.user_id AND available_amount > 0
    ORDER BY updated_at ASC FOR UPDATE
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

-- 4) Blinder l'ancienne table de retrait par groupe (lecture seule côté clients)
REVOKE INSERT, UPDATE, DELETE ON public.withdrawal_requests FROM anon, authenticated;