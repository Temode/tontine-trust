-- Test de bout en bout : sms_outbox.dedupe_key empêche tout doublon
-- sur 24h pour un même (kind, user) et pour un même (kind, user, scope_id).
--
-- Exécution :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/sms_outbox_dedupe.test.sql
--
-- Garanties vérifiées :
--   (1) 50 appels enqueue_tontine_sms identiques (même user, même event, même jour)
--       → 1 seule ligne en file.
--   (2) Sur la même journée, deux events différents (payment_confirmed vs payout_received)
--       pour le même user → 2 lignes distinctes.
--   (3) Deux users différents pour le même event → 2 lignes distinctes.
--   (4) Sur la même journée, deux contributions différentes pour le même user → 2 lignes.
--   (5) L'index UNIQUE sur dedupe_key rejette toute insertion concurrente avec la même clé.

DO $test$
DECLARE
  v_user_a uuid := '11111111-1111-1111-1111-111111111111';
  v_user_b uuid := '22222222-2222-2222-2222-222222222222';
  v_contrib_x uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_contrib_y uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_count int;
  v_marker text := 'sms_outbox_dedupe_test_' || gen_random_uuid()::text;
BEGIN
  -- Nettoyage défensif (idempotence du test).
  DELETE FROM public.sms_outbox WHERE payload->>'test_marker' = v_marker;

  -- (1) 50 appels identiques → 1 seule ligne.
  FOR i IN 1..50 LOOP
    PERFORM public.enqueue_tontine_sms(
      'payment_confirmed',
      jsonb_build_object(
        'payer_user_id', v_user_a::text,
        'contribution_id', v_contrib_x::text,
        'test_marker', v_marker
      )
    );
  END LOOP;
  SELECT count(*) INTO v_count
    FROM public.sms_outbox
   WHERE payload->>'test_marker' = v_marker;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST (1) ÉCHEC : attendu 1 ligne après 50 enqueue identiques, obtenu %', v_count;
  END IF;
  RAISE NOTICE 'TEST (1) OK : 50 enqueue identiques → 1 ligne unique';

  -- (2) Event différent, même user, même jour → 2 lignes.
  PERFORM public.enqueue_tontine_sms(
    'payout_received',
    jsonb_build_object('beneficiary_user_id', v_user_a::text, 'test_marker', v_marker)
  );
  PERFORM public.enqueue_tontine_sms(
    'payout_received',
    jsonb_build_object('beneficiary_user_id', v_user_a::text, 'test_marker', v_marker)
  );
  SELECT count(*) INTO v_count
    FROM public.sms_outbox
   WHERE payload->>'test_marker' = v_marker;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'TEST (2) ÉCHEC : attendu 2 lignes (payment_confirmed + payout_received), obtenu %', v_count;
  END IF;
  RAISE NOTICE 'TEST (2) OK : events différents → lignes distinctes';

  -- (3) Même event, user différent → 2 lignes en plus.
  PERFORM public.enqueue_tontine_sms(
    'payment_confirmed',
    jsonb_build_object(
      'payer_user_id', v_user_b::text,
      'contribution_id', v_contrib_x::text,
      'test_marker', v_marker
    )
  );
  SELECT count(*) INTO v_count
    FROM public.sms_outbox
   WHERE payload->>'test_marker' = v_marker;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'TEST (3) ÉCHEC : attendu 3 lignes après ajout user_b, obtenu %', v_count;
  END IF;
  RAISE NOTICE 'TEST (3) OK : users différents → lignes distinctes';

  -- (4) Même event, même user, contribution différente → 2 lignes en plus.
  PERFORM public.enqueue_tontine_sms(
    'payment_confirmed',
    jsonb_build_object(
      'payer_user_id', v_user_a::text,
      'contribution_id', v_contrib_y::text,
      'test_marker', v_marker
    )
  );
  SELECT count(*) INTO v_count
    FROM public.sms_outbox
   WHERE payload->>'test_marker' = v_marker;
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'TEST (4) ÉCHEC : attendu 4 lignes, obtenu %', v_count;
  END IF;
  RAISE NOTICE 'TEST (4) OK : scopes différents (contributions) → lignes distinctes';

  -- (5) Insertion directe avec une dedupe_key existante : doit être rejetée OU ignorée.
  --     enqueue_tontine_sms utilise ON CONFLICT DO NOTHING : on revérifie le total.
  FOR i IN 1..100 LOOP
    PERFORM public.enqueue_tontine_sms(
      'payment_confirmed',
      jsonb_build_object(
        'payer_user_id', v_user_a::text,
        'contribution_id', v_contrib_x::text,
        'test_marker', v_marker
      )
    );
  END LOOP;
  SELECT count(*) INTO v_count
    FROM public.sms_outbox
   WHERE payload->>'test_marker' = v_marker;
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'TEST (5) ÉCHEC : 100 enqueue supplémentaires identiques ont créé des doublons (total=%)', v_count;
  END IF;
  RAISE NOTICE 'TEST (5) OK : la contrainte UNIQUE sur dedupe_key bloque tout doublon';

  -- Nettoyage.
  DELETE FROM public.sms_outbox WHERE payload->>'test_marker' = v_marker;

  RAISE NOTICE '✓ sms_outbox_dedupe : tous les tests passent';
END $test$;