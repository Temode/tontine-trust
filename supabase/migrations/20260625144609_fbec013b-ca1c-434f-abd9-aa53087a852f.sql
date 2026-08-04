
-- 1) Supprime le trigger amplificateur sur notifications
DROP TRIGGER IF EXISTS trg_notifications_dispatch_late_sms ON public.notifications;
DROP FUNCTION IF EXISTS public.trg_dispatch_late_sms();

-- 2) Colonne is_test_group sur groups
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS is_test_group boolean NOT NULL DEFAULT false;

-- 3) Initialisation des clés internal_config pour le kill-switch + seuil + plafond
INSERT INTO public.internal_config (key, value)
VALUES
  ('sms_paused', 'false'),
  ('sms_min_balance', '50'),
  ('sms_max_per_run', '60')
ON CONFLICT (key) DO NOTHING;

-- 4) Cron horaire SÉQUENTIEL pour les rappels de retard (remplace le trigger)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('send-tontine-reminders-hourly')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-tontine-reminders-hourly');
    PERFORM cron.schedule(
      'send-tontine-reminders-hourly',
      '10 8-20 * * *',
      $cmd$
        SELECT net.http_post(
          url := 'https://oljyzmannzejtsbfpzxp.supabase.co/functions/v1/send-tontine-reminders',
          headers := jsonb_build_object(
            'Content-Type','application/json',
            'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sanl6bWFubnplanRzYmZwenhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NzUxMDMsImV4cCI6MjA5NzE1MTEwM30.q0JN5DH-T1hMgrbiuYek9Huw4H9qTh9KazisTPQzVrE'
          ),
          body := jsonb_build_object('triggered_by','cron_hourly')
        );
      $cmd$
    );
  END IF;
END$$;
