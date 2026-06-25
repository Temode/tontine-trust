DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER TABLE public.payments REPLICA IDENTITY FULL';
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.payments';
  EXCEPTION WHEN duplicate_object THEN NULL;
           WHEN others THEN NULL;
  END;
END $$;