-- Tests de non-régression : règles Solo & Internationale
--
-- Exécution :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/solo_and_international_rules.test.sql
--
-- Garanties vérifiées :
--   SOLO
--     (1) Un groupe kind='solo' est accepté avec max_members = 1
--         (validate_group_params ne doit PAS exiger 2 membres).
--     (2) max_members est forcé à 1 pour un solo, même si on tente plus.
--     (3) Un second membre ne peut pas rejoindre un groupe solo.
--     (4) Un groupe collectif à 1 membre reste refusé.
--   INTERNATIONALE
--     (5) apply_to_international_group accepte les groupes is_international
--         OU visibles dans l'annuaire (public-link / directory).
--     (6) Les statuts éligibles incluent draft et open.
--
-- Le test s'exécute dans une transaction annulée : aucune donnée persistée.

BEGIN;

DO $test$
DECLARE
  v_uid uuid;
  v_uid2 uuid;
  v_gid uuid;
  v_max int;
  v_src text;
  v_ok boolean;
BEGIN
  SELECT id INTO v_uid FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT id INTO v_uid2 FROM auth.users WHERE id <> v_uid ORDER BY created_at LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE NOTICE 'SKIP: aucun utilisateur disponible pour les tests Solo.';
  ELSE
    -- (1) + (2) création solo avec max_members volontairement erroné
    INSERT INTO public.groups (
      name, contribution_amount, frequency, max_members, rotation_order_kind,
      late_penalty_percent, late_penalty_after_days, status, visibility,
      created_by, kind, solo_mode
    ) VALUES (
      'test_solo_rules', 10000, 'mensuelle', 5, 'fixed',
      0, 0, 'active', 'private', v_uid, 'solo', 'working_capital'
    ) RETURNING id, max_members INTO v_gid, v_max;

    IF v_max <> 1 THEN
      RAISE EXCEPTION 'ECHEC (2): max_members attendu 1 pour un solo, obtenu %', v_max;
    END IF;
    RAISE NOTICE 'OK (1)(2): solo créé avec max_members = 1';

    -- (3) organisateur unique : un second membre doit être refusé
    IF v_uid2 IS NOT NULL THEN
      BEGIN
        INSERT INTO public.group_members (group_id, user_id, role, status)
        VALUES (v_gid, v_uid2, 'membre', 'active');
        RAISE EXCEPTION 'ECHEC (3): un second membre a pu rejoindre une tontine solo';
      EXCEPTION WHEN raise_exception OR check_violation OR unique_violation THEN
        IF SQLERRM LIKE 'ECHEC (3)%' THEN RAISE; END IF;
        RAISE NOTICE 'OK (3): second membre refusé (%)', SQLERRM;
      END;
    END IF;

    -- (4) un groupe collectif à 1 membre reste refusé
    BEGIN
      INSERT INTO public.groups (
        name, contribution_amount, frequency, max_members, rotation_order_kind,
        late_penalty_percent, late_penalty_after_days, status, visibility,
        created_by, kind
      ) VALUES (
        'test_collective_rules', 10000, 'mensuelle', 1, 'fixed',
        0, 0, 'draft', 'private', v_uid, 'collective'
      );
      RAISE EXCEPTION 'ECHEC (4): un groupe collectif à 1 membre a été accepté';
    EXCEPTION WHEN raise_exception OR check_violation THEN
      IF SQLERRM LIKE 'ECHEC (4)%' THEN RAISE; END IF;
      RAISE NOTICE 'OK (4): collectif à 1 membre refusé (%)', SQLERRM;
    END;
  END IF;

  -- (5) + (6) contrat de apply_to_international_group
  SELECT pg_get_functiondef(oid) INTO v_src
    FROM pg_proc WHERE proname = 'apply_to_international_group' LIMIT 1;
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'ECHEC (5): apply_to_international_group est absente';
  END IF;

  v_ok := v_src LIKE '%is_international%'
      AND (v_src LIKE '%directory%' OR v_src LIKE '%public-link%');
  IF NOT v_ok THEN
    RAISE EXCEPTION 'ECHEC (5): la candidature doit accepter is_international OU l''annuaire public';
  END IF;
  RAISE NOTICE 'OK (5): is_international + annuaire public pris en charge';

  IF v_src NOT LIKE '%draft%' OR v_src NOT LIKE '%open%' THEN
    RAISE EXCEPTION 'ECHEC (6): les statuts draft/open doivent rester éligibles';
  END IF;
  RAISE NOTICE 'OK (6): statuts draft/open éligibles';

  RAISE NOTICE 'Tous les tests Solo & Internationale sont passés.';
END
$test$;

ROLLBACK;
