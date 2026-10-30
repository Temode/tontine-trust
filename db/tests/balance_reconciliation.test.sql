-- Test automatisé du moteur de réconciliation des soldes.
--
-- Vérifie :
--   (1) aucun écart n'est signalé quand total_withdrawn = retraits traités,
--   (2) un écart 'withdrawn_mismatch' est détecté quand total_withdrawn diverge,
--   (3) un écart 'available_mismatch' est détecté quand available <> credited - withdrawn,
--   (4) les retraits 'pending' et 'rejected' n'entrent pas dans total_withdrawn attendu,
--   (5) admin_user_balance_journal retrace bien crédits, retraits et frais.
--
-- Utilise une transaction ROLLBACK ; aucune donnée n'est modifiée durablement.

BEGIN;

DO $test$
DECLARE
  v_uid uuid;
  v_gid uuid;
  v_run uuid;
  v_bb uuid;
  v_n int;
  v_journal int;
BEGIN
  SELECT id INTO v_uid FROM auth.users ORDER BY created_at DESC LIMIT 1;
  SELECT id INTO v_gid FROM public.groups LIMIT 1;
  IF v_uid IS NULL OR v_gid IS NULL THEN
    RAISE EXCEPTION 'TEST SKIP : données de base manquantes';
  END IF;

  -- Nettoyage du périmètre de test
  DELETE FROM public.user_withdrawal_requests WHERE user_id = v_uid;
  DELETE FROM public.beneficiary_balances WHERE user_id = v_uid;

  -- (1) Cas conforme : 100 000 crédités, 40 000 retirés/traités, 60 000 disponibles
  INSERT INTO public.beneficiary_balances (user_id, group_id, available_amount, total_credited, total_withdrawn)
  VALUES (v_uid, v_gid, 60000, 100000, 40000) RETURNING id INTO v_bb;

  INSERT INTO public.user_withdrawal_requests (user_id, amount, payment_method, status, processed_at)
  VALUES (v_uid, 40000, 'mobile_money_om', 'completed', now());

  SELECT public.run_balance_reconciliation('test') INTO v_run;
  SELECT COUNT(*) INTO v_n FROM public.balance_reconciliation_findings
   WHERE run_id = v_run AND user_id = v_uid;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ECHEC (1) : % écart(s) sur un état conforme', v_n;
  END IF;

  -- (4) Ajout d'un retrait pending + un rejeté : toujours conforme côté total_withdrawn
  INSERT INTO public.user_withdrawal_requests (user_id, amount, payment_method, status)
  VALUES (v_uid, 10000, 'mobile_money_momo', 'pending'),
         (v_uid, 25000, 'card', 'rejected');

  SELECT public.run_balance_reconciliation('test') INTO v_run;
  SELECT COUNT(*) INTO v_n FROM public.balance_reconciliation_findings
   WHERE run_id = v_run AND user_id = v_uid AND code = 'withdrawn_mismatch';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ECHEC (4) : pending/rejected comptés dans total_withdrawn';
  END IF;

  -- (2) Divergence : total_withdrawn doublé (régression triple comptage)
  UPDATE public.beneficiary_balances SET total_withdrawn = 80000 WHERE id = v_bb;

  SELECT public.run_balance_reconciliation('test') INTO v_run;
  SELECT COUNT(*) INTO v_n FROM public.balance_reconciliation_findings
   WHERE run_id = v_run AND user_id = v_uid AND code = 'withdrawn_mismatch' AND delta = 40000;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ECHEC (2) : écart withdrawn_mismatch non détecté (%)', v_n;
  END IF;

  -- (3) Divergence solde disponible
  UPDATE public.beneficiary_balances
     SET total_withdrawn = 40000, available_amount = 10000 WHERE id = v_bb;

  SELECT public.run_balance_reconciliation('test') INTO v_run;
  SELECT COUNT(*) INTO v_n FROM public.balance_reconciliation_findings
   WHERE run_id = v_run AND user_id = v_uid AND code = 'available_mismatch' AND delta = -50000;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ECHEC (3) : écart available_mismatch non détecté (%)', v_n;
  END IF;

  -- (5) Journal d'audit détaillé
  PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
  SELECT COUNT(*) INTO v_journal FROM public.admin_user_balance_journal(v_uid, 300);
  IF v_journal < 3 THEN
    RAISE EXCEPTION 'ECHEC (5) : journal incomplet (% lignes)', v_journal;
  END IF;

  RAISE NOTICE 'OK : réconciliation soldes — tous les scénarios validés';
END $test$;

ROLLBACK;
