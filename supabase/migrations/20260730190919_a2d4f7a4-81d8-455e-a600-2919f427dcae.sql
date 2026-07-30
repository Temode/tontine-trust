-- 1) Formule portefeuille : ne plus double-compter les retraits traités
CREATE OR REPLACE FUNCTION public.get_my_wallet()
RETURNS TABLE(available_amount bigint, locked_amount bigint, total_credited bigint, total_withdrawn bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_credited bigint;
  v_group_withdrawn bigint;
  v_available bigint;
  v_pending_global bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT
    COALESCE(SUM(bb.total_credited), 0),
    COALESCE(SUM(bb.total_withdrawn), 0),
    COALESCE(SUM(bb.available_amount), 0)
  INTO v_credited, v_group_withdrawn, v_available
  FROM public.beneficiary_balances bb
  WHERE bb.user_id = v_uid;

  SELECT COALESCE(SUM(amount), 0) INTO v_pending_global
  FROM public.user_withdrawal_requests
  WHERE user_id = v_uid AND status = 'pending';

  RETURN QUERY SELECT
    GREATEST(v_available - v_pending_global, 0)::bigint,
    v_pending_global::bigint,
    v_credited::bigint,
    v_group_withdrawn::bigint;
END $function$;

-- 2) Réparation : annuler les demandes héritées "pending" et restituer les montants
DO $repair$
DECLARE
  r RECORD;
  v_take bigint;
  v_bb RECORD;
  v_remaining bigint;
BEGIN
  FOR r IN SELECT * FROM public.withdrawal_requests WHERE status = 'pending' LOOP
    PERFORM set_config('app.withdrawal_ctx', r.id::text, true);
    v_remaining := r.amount;
    FOR v_bb IN
      SELECT id, total_withdrawn FROM public.beneficiary_balances
      WHERE user_id = r.user_id AND group_id = r.group_id AND total_withdrawn > 0
      ORDER BY updated_at DESC
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_bb.total_withdrawn, v_remaining);
      UPDATE public.beneficiary_balances
        SET available_amount = available_amount + v_take,
            total_withdrawn = total_withdrawn - v_take,
            updated_at = now()
      WHERE id = v_bb.id;
      v_remaining := v_remaining - v_take;
    END LOOP;

    UPDATE public.withdrawal_requests
      SET status = 'cancelled',
          notes = COALESCE(notes, '') || ' [annulée automatiquement : module de retrait par groupe supprimé]',
          processed_at = now()
    WHERE id = r.id;

    INSERT INTO public.audit_log (actor_user_id, group_id, action, entity_type, entity_id, metadata)
    VALUES (NULL, r.group_id, 'legacy_withdrawal_reversed', 'withdrawal_request', r.id,
            jsonb_build_object('user_id', r.user_id, 'amount', r.amount, 'restored', r.amount - v_remaining));
  END LOOP;
END
$repair$;

-- 3) Verrouiller définitivement l'ancienne table
REVOKE INSERT, UPDATE, DELETE ON public.withdrawal_requests FROM authenticated, anon;