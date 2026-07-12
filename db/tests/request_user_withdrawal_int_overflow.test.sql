-- Non-régression : reproduit le cas « integer out of range » (SQLSTATE 22003)
-- provoqué par l'ancien verrou `pg_advisory_xact_lock(4242, hashtextextended(...)::int)`.
--
-- Le correctif utilise `pg_advisory_xact_lock(hashtextextended(..., 0))` (bigint),
-- donc la RPC doit réussir même quand hashtextextended renvoie une valeur > 2^31.
--
-- Le test :
--   (a) vérifie qu'il existe bien un uuid qui, une fois haché, dépasse 2^31 → prouve
--       que le cas défectueux serait déclenché avec l'ancien code ;
--   (b) exécute request_user_withdrawal avec un tel user_id et un solde suffisant ;
--       aucune exception 22003 ne doit être levée.

BEGIN;

DO $test$
DECLARE
  v_uid uuid;
  v_hash bigint;
  v_bb_id uuid;
  v_wid uuid;
BEGIN
  -- (a) Trouve un user existant dont le hash sort de la plage int32.
  SELECT u.id, hashtextextended('user_withdrawal:' || u.id::text, 0)
    INTO v_uid, v_hash
  FROM auth.users u
  LEFT JOIN public.user_roles r ON r.user_id = u.id AND r.role IN ('admin','super_admin')
  WHERE r.user_id IS NULL
    AND abs(hashtextextended('user_withdrawal:' || u.id::text, 0)) > 2147483647
  LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE NOTICE 'SKIP : aucun user avec hash > 2^31 dans la base de test';
    RETURN;
  END IF;
  RAISE NOTICE 'Cas reproduit : uid=% hash=% (|hash|>2^31)', v_uid, v_hash;

  -- Simule auth.uid()
  PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Provisionne un solde
  INSERT INTO public.beneficiary_balances (user_id, group_id, available_amount, total_credited, total_withdrawn, currency)
  SELECT v_uid, (SELECT id FROM public.groups LIMIT 1), 50000, 50000, 0, 'GNF'
  RETURNING id INTO v_bb_id;

  -- (b) Doit passer sans SQLSTATE 22003
  BEGIN
    v_wid := public.request_user_withdrawal(10000, 'mobile_money_om',
      jsonb_build_object('phone','622999999','phone_confirm','622999999'));
    IF v_wid IS NULL THEN
      RAISE EXCEPTION 'FAIL : aucun id retourné';
    END IF;
    RAISE NOTICE 'OK : demande créée % (pas d''overflow int)', v_wid;
  EXCEPTION
    WHEN numeric_value_out_of_range THEN
      RAISE EXCEPTION 'REGRESSION : SQLSTATE 22003 relevé — le cast int a été réintroduit';
  END;
END $test$;

ROLLBACK;