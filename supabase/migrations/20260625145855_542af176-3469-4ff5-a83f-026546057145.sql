
-- ============================================================
-- 1. File d'envoi SMS (outbox) — 1 ligne = 1 SMS pour 1 user
-- ============================================================
create table if not exists public.sms_outbox (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,
  payload      jsonb not null default '{}'::jsonb,
  dedupe_key   text not null,
  status       text not null default 'queued' check (status in ('queued','processing','sent','skipped','failed')),
  attempts     int  not null default 0,
  last_error   text,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);

create unique index if not exists sms_outbox_dedupe_key_uidx
  on public.sms_outbox(dedupe_key);

create index if not exists sms_outbox_status_created_idx
  on public.sms_outbox(status, created_at)
  where status = 'queued';

grant all on public.sms_outbox to service_role;

alter table public.sms_outbox enable row level security;

-- Aucune policy pour anon/authenticated : seul service_role accède.

-- ============================================================
-- 2. enqueue_tontine_sms : ne fait plus de net.http_post, juste un insert
-- ============================================================
create or replace function public.enqueue_tontine_sms(
  _kind text,
  _payload jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_key text;
begin
  -- Construit une clé d'idempotence stable depuis le payload.
  -- Convention : clés rangées par criticité (kind + contribution / turn / withdrawal + user).
  v_key := coalesce(
    _payload->>'dedupe_key',
    _kind || ':' ||
      coalesce(_payload->>'contribution_id','-') || ':' ||
      coalesce(_payload->>'turn_id','-') || ':' ||
      coalesce(_payload->>'withdrawal_id','-') || ':' ||
      coalesce(_payload->>'payer_user_id', _payload->>'beneficiary_user_id', _payload->>'user_id', '-')
  );

  insert into public.sms_outbox(kind, payload, dedupe_key)
  values (_kind, _payload, v_key)
  on conflict (dedupe_key) do nothing;
exception when others then
  raise warning '[enqueue_tontine_sms] échec: %', sqlerrm;
end; $$;

revoke all on function public.enqueue_tontine_sms(text, jsonb) from public;
grant execute on function public.enqueue_tontine_sms(text, jsonb) to service_role;

-- ============================================================
-- 3. Suppression des triggers SMS non critiques (doctrine Paxefy)
--    Les events restent en notification in-app — uniquement les SMS sont coupés.
-- ============================================================
drop trigger if exists sms_withdrawal_lifecycle      on public.withdrawal_requests;
drop trigger if exists sms_payment_admin_decision    on public.payments;
drop trigger if exists sms_cycle_started             on public.cycles;
drop trigger if exists sms_group_pause_resume        on public.groups;
drop trigger if exists sms_member_status             on public.group_members;
drop trigger if exists sms_pause_request_decision    on public.payment_pause_requests;
drop trigger if exists sms_dispute                   on public.contribution_disputes;
drop trigger if exists sms_default_report            on public.member_default_reports;
drop trigger if exists sms_group_deletion            on public.group_deletion_requests;

-- ============================================================
-- 4. Désactivation des crons de rappels boucle
-- ============================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'send-tontine-reminders-hourly') then
      perform cron.unschedule('send-tontine-reminders-hourly');
    end if;
    if exists (select 1 from cron.job where jobname = 'send-tontine-reminders-daily') then
      perform cron.unschedule('send-tontine-reminders-daily');
    end if;
    if exists (select 1 from cron.job where jobname = 'tontine_payment_reminders') then
      perform cron.unschedule('tontine_payment_reminders');
    end if;

    -- 5. Cron consume-sms-outbox toutes les 2 minutes (séquentiel)
    if exists (select 1 from cron.job where jobname = 'consume-sms-outbox') then
      perform cron.unschedule('consume-sms-outbox');
    end if;
    perform cron.schedule(
      'consume-sms-outbox',
      '*/2 * * * *',
      $cmd$
        select net.http_post(
          url := 'https://oljyzmannzejtsbfpzxp.supabase.co/functions/v1/consume-sms-outbox',
          headers := jsonb_build_object(
            'Content-Type','application/json',
            'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sanl6bWFubnplanRzYmZwenhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NzUxMDMsImV4cCI6MjA5NzE1MTEwM30.q0JN5DH-T1hMgrbiuYek9Huw4H9qTh9KazisTPQzVrE'
          ),
          body := jsonb_build_object('triggered_by','cron_2min')
        );
      $cmd$
    );
  end if;
end$$;

-- ============================================================
-- 6. Pop FIFO atomique pour le worker outbox
-- ============================================================
create or replace function public.sms_outbox_pop(_limit int default 20)
returns setof public.sms_outbox
language sql security definer set search_path = public as $$
  with cte as (
    select id from public.sms_outbox
     where status = 'queued'
     order by created_at
     limit greatest(_limit, 1)
     for update skip locked
  )
  update public.sms_outbox o
     set status = 'processing',
         attempts = attempts + 1
    from cte
   where o.id = cte.id
  returning o.*;
$$;

revoke all on function public.sms_outbox_pop(int) from public;
grant execute on function public.sms_outbox_pop(int) to service_role;

-- ============================================================
-- 7. Marquage du résultat
-- ============================================================
create or replace function public.sms_outbox_mark(
  _id uuid,
  _status text,
  _error text default null
) returns void
language sql security definer set search_path = public as $$
  update public.sms_outbox
     set status = _status,
         last_error = _error,
         processed_at = now()
   where id = _id;
$$;

revoke all on function public.sms_outbox_mark(uuid, text, text) from public;
grant execute on function public.sms_outbox_mark(uuid, text, text) to service_role;
