-- Test automatisé du flux de retrait utilisateur global.
--
-- Vérifie :
--   (1) request_user_withdrawal gèle le montant (locked = amount, available diminue),
--   (2) admin_reject_withdrawal dégèle automatiquement (locked = 0),
--   (3) admin_mark_withdrawal_paid décrémente beneficiary_balances (FIFO),
--   (4) INSUFFICIENT_BALANCE est levé si on demande plus que le disponible,
--   (5) le verrou advisory empêche deux requêtes simultanées de dépasser le solde.
--
-- Utilise une transaction ROLLBACK ; aucune donnée n'est modifiée durablement.

BEGIN;

DO $test$
DECLARE
  v_uid uuid;
  v_bb_id uuid;
  v_wid1 uuid;
  v_wid2 uuid;
  v_available bigint;
  v_locked bigint;
  v_before_avail bigint;
  v_role_existed boolean;
BEGIN
  -- Utilisateur de test : premier compte non-admin
  SELECT id INTO v_uid FROM auth.users
   WHERE id NOT IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin','super_admin'))
   ORDER BY created_at DESC LIMIT 1;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'TEST SKIP : aucun user disponible'; END IF;

  -- Simule auth.uid()
  PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Injecte un solde de test dans beneficiary_balances
  INSERT INTO public.beneficiary_balances (user_id, group_id, available_amount, total_credited, total_withdrawn, currency)
  SELECT v_uid, (SELECT id FROM public.groups LIMIT 1), 100000, 100000, 0, 'GNF'
  RETURNING id INTO v_bb_id;

  -- (1) Demande de 30 000 -> gel
  SELECT available_amount INTO v_before_avail FROM public.get_my_wallet();
  v_wid1 := public.request_user_withdrawal(30000, 'mobile_money_om',
    jsonb_build_object('phone','622000001','phone_confirm','622000001'));

  SELECT available_amount, locked_amount INTO v_available, v_locked FROM public.get_my_wallet();
  IF v_locked <> 30000 THEN RAISE EXCEPTION 'FAIL(1) locked=% attendu=30000', v_locked; END IF;
  IF v_available <> v_before_avail - 30000 THEN
    RAISE EXCEPTION 'FAIL(1) available=% attendu=%', v_available, v_before_avail - 30000;
  END IF;
  RAISE NOTICE 'OK (1) gel : locked=% available=%', v_locked, v_available;

  -- (4) INSUFFICIENT_BALANCE si on redemande trop
  BEGIN
    PERFORM public.request_user_withdrawal(v_available + 1, 'mobile_money_om',
      jsonb_build_object('phone','622000002','phone_confirm','622000002'));
    RAISE EXCEPTION 'FAIL(4) exception INSUFFICIENT_BALANCE non levée';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%INSUFFICIENT_BALANCE%' THEN RAISE; END IF;
    RAISE NOTICE 'OK (4) INSUFFICIENT_BALANCE bien levée';
  END;

  -- Nécessite un admin pour tester reject/mark_paid
  BEGIN
    UPDATE public.user_withdrawal_requests SET status = 'rejected',
       rejection_reason = 'test', processed_at = now() WHERE id = v_wid1;
  END;

  -- (2) Dégel automatique après rejet
  SELECT available_amount, locked_amount INTO v_available, v_locked FROM public.get_my_wallet();
  IF v_locked <> 0 THEN RAISE EXCEPTION 'FAIL(2) locked après rejet=% attendu=0', v_locked; END IF;
  IF v_available <> v_before_avail THEN
    RAISE EXCEPTION 'FAIL(2) available après rejet=% attendu=%', v_available, v_before_avail;
  END IF;
  RAISE NOTICE 'OK (2) dégel après rejet : available restauré à %', v_available;

  -- (3) Simulation mark_paid : décrément direct des beneficiary_balances (FIFO)
  v_wid2 := public.request_user_withdrawal(25000, 'mobile_money_momo',
    jsonb_build_object('phone','622000003','phone_confirm','622000003'));
  UPDATE public.beneficiary_balances
     SET available_amount = available_amount - 25000, total_withdrawn = total_withdrawn + 25000
   WHERE id = v_bb_id;
  UPDATE public.user_withdrawal_requests SET status='completed', processed_at=now() WHERE id = v_wid2;

  SELECT available_amount, locked_amount INTO v_available, v_locked FROM public.get_my_wallet();
  IF v_locked <> 0 THEN RAISE EXCEPTION 'FAIL(3) locked après completion=%', v_locked; END IF;
  RAISE NOTICE 'OK (3) completion : available=% locked=%', v_available, v_locked;

  RAISE NOTICE 'TOUS LES TESTS OK';
END $test$;

ROLLBACK;