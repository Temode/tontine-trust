-- Tests de non-régression : relance d'un cycle (opt-in des membres)
--
-- Exécution :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/cycle_renewal.test.sql
--
-- Garanties vérifiées :
--   (1) open_cycle_renewal refuse un seuil < 2 ou une date limite passée.
--   (2) L'ouverture marque le cycle awaiting_renewal et confirme l'organisateur.
--   (3) vote_cycle_renewal est idempotent (un seul vote par membre, modifiable).
--   (4) Un vote après la date limite est refusé.
--   (5) renewal_status recalcule le pot projeté = cotisation x confirmés.
--   (6) start_renewed_cycle refuse tant que le seuil n'est pas atteint.
--
-- Transaction annulée : aucune donnée persistée.

BEGIN;

DO $test$
DECLARE
  v_org uuid; v_m1 uuid; v_m2 uuid;
  v_gid uuid; v_cid uuid;
  v_st jsonb; v_n int; v_ok boolean;
BEGIN
  SELECT id INTO v_org FROM public.profiles ORDER BY created_at LIMIT 1;
  SELECT id INTO v_m1 FROM public.profiles WHERE id <> v_org ORDER BY created_at LIMIT 1;
  SELECT id INTO v_m2 FROM public.profiles WHERE id NOT IN (v_org, v_m1) ORDER BY created_at LIMIT 1;
  IF v_m2 IS NULL THEN
    RAISE NOTICE 'SKIP: 3 utilisateurs requis pour le test de relance.';
    RETURN;
  END IF;

  INSERT INTO public.groups (
    name, contribution_amount, frequency, max_members, rotation_order_kind,
    late_penalty_percent, late_penalty_after_days, status, visibility, created_by
  ) VALUES (
    'TEST relance', 100000, 'mensuelle', 3, 'random', 0, 3, 'completed', 'private', v_org
  ) RETURNING id INTO v_gid;

  INSERT INTO public.group_members (group_id, user_id, role, status, position)
  VALUES (v_gid, v_org, 'organisateur', 'active', 1),
         (v_gid, v_m1, 'membre', 'active', 2),
         (v_gid, v_m2, 'membre', 'active', 3);

  INSERT INTO public.cycles (group_id, cycle_number, started_at, ended_at)
  VALUES (v_gid, 1, now() - interval '90 days', now() - interval '1 day')
  RETURNING id INTO v_cid;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_org)::text, true);

  -- (1) seuil invalide
  v_ok := false;
  BEGIN
    PERFORM public.open_cycle_renewal(v_gid, 1, now() + interval '7 days');
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL (1a): seuil < 2 accepté'; END IF;

  v_ok := false;
  BEGIN
    PERFORM public.open_cycle_renewal(v_gid, 2, now() - interval '1 day');
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL (1b): date limite passée acceptée'; END IF;

  -- (2) ouverture valide
  PERFORM public.open_cycle_renewal(v_gid, 3, now() + interval '7 days');
  IF NOT (SELECT awaiting_renewal FROM public.cycles WHERE id = v_cid) THEN
    RAISE EXCEPTION 'FAIL (2a): cycle non marqué awaiting_renewal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cycle_renewal_votes
                 WHERE cycle_id = v_cid AND user_id = v_org AND agreed) THEN
    RAISE EXCEPTION 'FAIL (2b): organisateur non confirmé d''office';
  END IF;

  -- (3) vote idempotent et modifiable
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m1)::text, true);
  PERFORM public.vote_cycle_renewal(v_cid, false);
  PERFORM public.vote_cycle_renewal(v_cid, true);
  SELECT count(*) INTO v_n FROM public.cycle_renewal_votes
   WHERE cycle_id = v_cid AND user_id = v_m1;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL (3): % votes pour un même membre', v_n; END IF;
  IF NOT (SELECT agreed FROM public.cycle_renewal_votes
          WHERE cycle_id = v_cid AND user_id = v_m1) THEN
    RAISE EXCEPTION 'FAIL (3b): dernier vote non pris en compte';
  END IF;

  -- (5) pot projeté = cotisation x confirmés (2 confirmés ici)
  SELECT public.renewal_status(v_gid) INTO v_st;
  IF (v_st->>'accepted')::int <> 2 THEN
    RAISE EXCEPTION 'FAIL (5a): accepted = %', v_st->>'accepted';
  END IF;
  IF (v_st->>'projected_payout')::bigint <> 200000 THEN
    RAISE EXCEPTION 'FAIL (5b): pot projeté = %', v_st->>'projected_payout';
  END IF;

  -- (6) seuil (3) non atteint => démarrage refusé
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_org)::text, true);
  v_ok := false;
  BEGIN
    PERFORM public.start_renewed_cycle(v_gid);
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL (6): démarrage accepté sous le seuil'; END IF;

  -- (4) vote hors délai
  UPDATE public.cycles SET renewal_deadline = now() - interval '1 hour' WHERE id = v_cid;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m2)::text, true);
  v_ok := false;
  BEGIN
    PERFORM public.vote_cycle_renewal(v_cid, true);
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL (4): vote accepté après la date limite'; END IF;

  RAISE NOTICE 'OK: relance de cycle — tous les invariants vérifiés.';
END $test$;

ROLLBACK;