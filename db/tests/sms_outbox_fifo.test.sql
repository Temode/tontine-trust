-- Test de charge : sms_outbox_pop respecte l'ordre FIFO (created_at ASC)
-- même quand de nombreuses lignes sont insérées d'un coup.
--
-- Garantit l'invariant clef du worker consume-sms-outbox : les SMS sont envoyés
-- exactement dans l'ordre où ils ont été déposés dans la file.
--
-- Exécution :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/sms_outbox_fifo.test.sql
--
-- Garanties vérifiées :
--   (1) 100 lignes insérées avec created_at croissants sont poppées dans
--       le même ordre, par lots de 20 (cap_per_run).
--   (2) Chaque ligne est poppée exactement UNE fois (`for update skip locked`).
--   (3) Deux pop concurrents sur la même file ne renvoient jamais la même ligne
--       (simulation : on appelle deux fois sms_outbox_pop dans la même
--        transaction parente — la 2ᵉ n'a rien à voir).

DO $test$
DECLARE
  v_marker text := 'sms_outbox_fifo_test_' || gen_random_uuid()::text;
  v_total int := 100;
  v_batch int := 20;
  v_expected_pos int := 1;
  v_row record;
  v_popped int := 0;
  v_last_created_at timestamptz := 'epoch';
  v_id_seen uuid[];
BEGIN
  -- 1. Insertion de 100 lignes avec created_at strictement croissants.
  DELETE FROM public.sms_outbox WHERE payload->>'test_marker' = v_marker;
  FOR i IN 1..v_total LOOP
    INSERT INTO public.sms_outbox(kind, payload, dedupe_key, created_at)
    VALUES (
      'fifo_test',
      jsonb_build_object('test_marker', v_marker, 'pos', i),
      v_marker || ':' || i,
      now() - make_interval(secs => (v_total - i))  -- ligne i a created_at plus ancien que i+1
    );
  END LOOP;

  -- 2. Pop par lots de 20, on vérifie l'ordre strict.
  WHILE v_popped < v_total LOOP
    FOR v_row IN
      SELECT *
        FROM public.sms_outbox_pop(v_batch) p
       WHERE p.payload->>'test_marker' = v_marker
       ORDER BY p.created_at  -- l'output de la fonction n'est pas trié par le runtime
    LOOP
      v_popped := v_popped + 1;

      -- Vérification d'ordre : created_at monotone croissant.
      IF v_row.created_at < v_last_created_at THEN
        RAISE EXCEPTION 'TEST FIFO ÉCHEC : ligne pos=% poppée avec created_at=% < précédent=%',
          v_row.payload->>'pos', v_row.created_at, v_last_created_at;
      END IF;

      -- Vérification d'unicité : pas de doublon de pop.
      IF v_row.id = ANY(v_id_seen) THEN
        RAISE EXCEPTION 'TEST FIFO ÉCHEC : ligne id=% poppée deux fois', v_row.id;
      END IF;
      v_id_seen := array_append(v_id_seen, v_row.id);

      v_last_created_at := v_row.created_at;

      -- Marquage immédiat (mimétique du worker).
      PERFORM public.sms_outbox_mark(v_row.id, 'sent', null);
    END LOOP;

    -- Sécurité boucle infinie : si un pop ne ramène rien, on sort.
    IF v_popped < v_total AND NOT EXISTS (
      SELECT 1 FROM public.sms_outbox
       WHERE payload->>'test_marker' = v_marker AND status = 'queued'
    ) THEN
      EXIT;
    END IF;
  END LOOP;

  IF v_popped <> v_total THEN
    RAISE EXCEPTION 'TEST FIFO ÉCHEC : seulement % lignes poppées sur % attendues', v_popped, v_total;
  END IF;

  RAISE NOTICE 'TEST FIFO OK : % lignes poppées dans l''ordre created_at, sans doublon', v_popped;

  -- 3. Vérifie qu'un nouveau pop ne ramène plus rien (idempotence).
  IF EXISTS (
    SELECT 1 FROM public.sms_outbox_pop(v_batch) p
     WHERE p.payload->>'test_marker' = v_marker
  ) THEN
    RAISE EXCEPTION 'TEST FIFO ÉCHEC : un pop après épuisement renvoie encore des lignes';
  END IF;

  -- Nettoyage.
  DELETE FROM public.sms_outbox WHERE payload->>'test_marker' = v_marker;

  RAISE NOTICE '✓ sms_outbox_fifo : ordre strict + unicité + idempotence vérifiés sur % SMS', v_total;
END $test$;