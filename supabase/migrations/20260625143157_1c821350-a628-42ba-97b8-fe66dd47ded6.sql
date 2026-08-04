
-- =====================================================================
-- SMS dedupe + admin alerting (anti-doublon + visibilité solde Nimba)
-- =====================================================================

-- 1) Table d'unicité atomique pour les envois SMS
create table if not exists public.sms_dedupe_keys (
  dedupe_key text primary key,
  created_at timestamptz not null default now()
);

grant select on public.sms_dedupe_keys to service_role;
grant all on public.sms_dedupe_keys to service_role;

alter table public.sms_dedupe_keys enable row level security;
-- Aucune policy publique : accès via SECURITY DEFINER ou service_role.

create index if not exists sms_dedupe_keys_created_at_idx
  on public.sms_dedupe_keys(created_at);

-- 2) RPC SECURITY DEFINER — claim atomique de la clé
create or replace function public.claim_sms_dedupe(_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int;
begin
  if _key is null or length(trim(_key)) = 0 then
    return true; -- pas de dedupe → autorise
  end if;
  insert into public.sms_dedupe_keys (dedupe_key) values (_key)
  on conflict (dedupe_key) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted > 0;
end;
$$;

revoke all on function public.claim_sms_dedupe(text) from public;
grant execute on function public.claim_sms_dedupe(text) to service_role;

-- 3) Purge des clés > 7 jours (cron quotidien)
create or replace function public.purge_sms_dedupe_keys()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_count int;
begin
  delete from public.sms_dedupe_keys
   where created_at < now() - interval '7 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.purge_sms_dedupe_keys() to service_role;

do $$
declare v_jobid int;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_jobid from cron.job where jobname = 'purge-sms-dedupe-keys';
    if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
    perform cron.schedule(
      'purge-sms-dedupe-keys',
      '15 3 * * *',
      $cron$ select public.purge_sms_dedupe_keys(); $cron$
    );
  end if;
end $$;

-- 4) Nouveaux types de notifications (alerte admin)
do $$ begin
  alter type public.notification_kind add value if not exists 'sms_delivery_failed';
  alter type public.notification_kind add value if not exists 'nimba_balance_low';
end $$;
