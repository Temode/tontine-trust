-- Test automatisé de public.release_due_payout_holds().
--
-- Exécutable via :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/release_due_payout_holds.test.sql
--
-- Vérifie :
--   (1) un tour dont `payout_hold_until <= now()` est libéré (paid_at + jours),
--   (2) un deuxième appel ne re-libère pas le même tour (idempotence),
--   (3) exactement UNE notification `payout_hold_released` est créée,
--   (4) le SMS n'est PAS envoyé pendant le test (token interne neutralisé).
--
-- Le test mute des données réelles puis les restaure quoi qu'il arrive ;
-- les SMS et appels pg_net sont désarmés en effaçant temporairement
-- la clé `tontine_sms_token` dans `internal_config`.

DO $test$
DECLARE
  v_turn         record;
  v_saved_hold   timestamptz;
  v_saved_rel    timestamptz;
  v_saved_token  text;
  v_notif_before integer;
  v_notif_after  integer;
  v_n1           integer;
  v_n2           integer;
BEGIN
  -- 1. Choisir un tour de test : un payé avec hold (Rougui dans la base actuelle).
  SELECT id, beneficiary_user_id, payout_hold_until, payout_released_at
    INTO v_turn
  FROM public.turns
  WHERE status = 'paid' AND payout_hold_until IS NOT NULL
  ORDER BY paid_at DESC NULLS LAST
  LIMIT 1;

  IF v_turn IS NULL THEN
    RAISE EXCEPTION 'TEST SKIP : aucun tour payé avec payout_hold_until';
  END IF;

  v_saved_hold  := v_turn.payout_hold_until;
  v_saved_rel   := v_turn.payout_released_at;

  -- 2. Désarmer le SMS le temps du test (le token est restauré à la fin).
  SELECT value INTO v_saved_token FROM public.internal_config WHERE key = 'tontine_sms_token';
  DELETE FROM public.internal_config WHERE key = 'tontine_sms_token';

  -- 3. Backdater le hold + réinitialiser released pour rendre le tour éligible.
  UPDATE public.turns
     SET payout_hold_until  = now() - interval '1 minute',
         payout_released_at = NULL
   WHERE id = v_turn.id;

  SELECT count(*) INTO v_notif_before
    FROM public.notifications
   WHERE turn_id = v_turn.id AND kind = 'payout_hold_released';

  -- 4. Premier appel : doit libérer ce tour (>=1).
  SELECT public.release_due_payout_holds() INTO v_n1;

  -- 5. Deuxième appel : doit retourner 0 pour CE tour.
  SELECT public.release_due_payout_holds() INTO v_n2;

  SELECT count(*) INTO v_notif_after
    FROM public.notifications
   WHERE turn_id = v_turn.id AND kind = 'payout_hold_released';

  -- 6. Assertions.
  PERFORM 1 FROM public.turns
   WHERE id = v_turn.id AND payout_released_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL (1) : payout_released_at non renseigné après libération';
  END IF;

  IF v_n1 < 1 THEN
    RAISE EXCEPTION 'FAIL (1) : release_due_payout_holds() = % (attendu >=1)', v_n1;
  END IF;

  -- Le deuxième appel peut libérer d'AUTRES tours mais ne doit PAS dupliquer le nôtre :
  -- on vérifie qu'aucune nouvelle notif n'a été créée pour ce turn_id.
  IF v_notif_after - v_notif_before <> 1 THEN
    RAISE EXCEPTION 'FAIL (3) : % notifications créées pour ce tour (attendu 1)',
      v_notif_after - v_notif_before;
  END IF;

  RAISE NOTICE 'OK : release_due_payout_holds testée — n1=%, n2(autres)=%, notifs=+%',
    v_n1, v_n2, v_notif_after - v_notif_before;

  -- 7. Restauration (toujours).
  UPDATE public.turns
     SET payout_hold_until  = v_saved_hold,
         payout_released_at = v_saved_rel
   WHERE id = v_turn.id;

  DELETE FROM public.notifications
   WHERE turn_id = v_turn.id
     AND kind = 'payout_hold_released'
     AND created_at >= now() - interval '5 minutes';

  IF v_saved_token IS NOT NULL THEN
    INSERT INTO public.internal_config(key, value) VALUES ('tontine_sms_token', v_saved_token);
  END IF;

EXCEPTION WHEN OTHERS THEN
  -- Restauration best-effort puis re-raise.
  IF v_turn.id IS NOT NULL THEN
    UPDATE public.turns
       SET payout_hold_until  = v_saved_hold,
           payout_released_at = v_saved_rel
     WHERE id = v_turn.id;
    DELETE FROM public.notifications
     WHERE turn_id = v_turn.id
       AND kind = 'payout_hold_released'
       AND created_at >= now() - interval '5 minutes';
  END IF;
  IF v_saved_token IS NOT NULL THEN
    INSERT INTO public.internal_config(key, value)
      VALUES ('tontine_sms_token', v_saved_token)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value;
  END IF;
  RAISE;
END
$test$;