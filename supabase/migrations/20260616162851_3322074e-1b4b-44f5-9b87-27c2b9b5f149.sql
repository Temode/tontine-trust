
DO $$
DECLARE
  audit_uids uuid[];
  audit_gids uuid[];
  r record;
BEGIN
  SELECT array_agg(id) INTO audit_uids FROM auth.users
   WHERE email LIKE '%.audit+%@tontine.test' OR email LIKE '%.test+%@tontine.test';
  IF audit_uids IS NULL THEN RETURN; END IF;

  SELECT array_agg(id) INTO audit_gids FROM public.groups
   WHERE created_by = ANY(audit_uids);

  IF audit_gids IS NOT NULL THEN
    FOR r IN
      SELECT c.table_name FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name
      WHERE c.table_schema='public' AND c.column_name='group_id' AND t.table_type='BASE TABLE'
    LOOP
      EXECUTE format('DELETE FROM public.%I WHERE group_id = ANY($1)', r.table_name) USING audit_gids;
    END LOOP;
    DELETE FROM public.groups WHERE id = ANY(audit_gids);
  END IF;

  FOR r IN
    SELECT c.table_name, c.column_name FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE c.table_schema='public' AND t.table_type='BASE TABLE'
      AND c.column_name IN ('user_id','payer_user_id','beneficiary_user_id','from_user_id','to_user_id','requested_by','approved_by','reviewer_user_id','reviewee_user_id','actor_user_id','target_user_id','created_by','organizer_user_id')
  LOOP
    BEGIN
      EXECUTE format('DELETE FROM public.%I WHERE %I = ANY($1)', r.table_name, r.column_name) USING audit_uids;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip %.%: %', r.table_name, r.column_name, SQLERRM;
    END;
  END LOOP;

  DELETE FROM public.profiles WHERE id = ANY(audit_uids);
  DELETE FROM auth.users WHERE id = ANY(audit_uids);
END $$;
