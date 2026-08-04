-- ============================================================
-- 48_immediate_late_sms.sql — SMS immédiat dès J+1
-- ============================================================

-- 1. Trigger : à chaque notification 'contribution_late', invoquer
--    immédiatement l'edge function send-tontine-reminders (fire-and-forget)
create or replace function public.trg_dispatch_late_sms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'contribution_late' then
    begin
      perform net.http_post(
        url := 'https://oljyzmannzejtsbfpzxp.supabase.co/functions/v1/send-tontine-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sanl6bWFubnplanRzYmZwenhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NzUxMDMsImV4cCI6MjA5NzE1MTEwM30.q0JN5DH-T1hMgrbiuYek9Huw4H9qTh9KazisTPQzVrE'
        ),
        body := jsonb_build_object('triggered_at', now(), 'source','late_notification_trigger', 'notification_id', new.id)
      );
    exception when others then
      -- ne bloque jamais l'insert de la notification
      raise warning 'trg_dispatch_late_sms http_post failed: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notifications_dispatch_late_sms on public.notifications;
create trigger trg_notifications_dispatch_late_sms
  after insert on public.notifications
  for each row execute function public.trg_dispatch_late_sms();

-- 2. Resserrer le cron de détection à toutes les 15 minutes (8h-22h)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('tontine-late-alerts-hourly')
      where exists (select 1 from cron.job where jobname = 'tontine-late-alerts-hourly');
    perform cron.unschedule('tontine-late-alerts-15min')
      where exists (select 1 from cron.job where jobname = 'tontine-late-alerts-15min');
    perform cron.schedule(
      'tontine-late-alerts-15min',
      '*/15 8-22 * * *',
      $cmd$ select public.enqueue_late_payment_alerts(); $cmd$
    );
  end if;
end$$;

-- 3. Mettre à jour le seed pour activer le SMS 'contribution_late' par défaut
create or replace function public.seed_notification_preferences(_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  k public.notification_kind;
  email_default boolean;
  sms_default boolean;
begin
  for k in select unnest(enum_range(null::public.notification_kind)) loop
    insert into public.notification_preferences(user_id, notif_type, channel, enabled)
    values (_user_id, k, 'in_app', true)
    on conflict do nothing;
    email_default := (k <> 'system');
    insert into public.notification_preferences(user_id, notif_type, channel, enabled)
    values (_user_id, k, 'email', email_default)
    on conflict do nothing;
    -- SMS : off par défaut, sauf alertes critiques de retard
    sms_default := (k = 'contribution_late');
    insert into public.notification_preferences(user_id, notif_type, channel, enabled)
    values (_user_id, k, 'sms', sms_default)
    on conflict do nothing;
  end loop;
end; $$;

-- 4. Helper should_notify : défaut SMS = true pour contribution_late uniquement
create or replace function public.should_notify(
  _user_id uuid,
  _type public.notification_kind,
  _channel public.notification_channel
) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select enabled from public.notification_preferences
      where user_id = _user_id and notif_type = _type and channel = _channel),
    case
      when _channel = 'sms' and _type = 'contribution_late' then true
      when _channel = 'sms' then false
      else true
    end
  );
$$;
