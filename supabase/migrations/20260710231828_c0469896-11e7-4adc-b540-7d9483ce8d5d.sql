ALTER TABLE public.user_subscriptions REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_subscriptions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;