-- =====================================================================
-- Phase D2 — TTL audit_log (purge mensuelle > 6 ans)
-- Idempotent.
-- =====================================================================

create extension if not exists pg_cron;

create table if not exists public.audit_log_purge_history (
  id uuid primary key default gen_random_uuid(),
  purged_at timestamptz not null default now(),
  rows_deleted bigint not null
);

grant select on public.audit_log_purge_history to authenticated;
grant all on public.audit_log_purge_history to service_role;

alter table public.audit_log_purge_history enable row level security;

drop policy if exists "audit_purge_select_service" on public.audit_log_purge_history;
create policy "audit_purge_select_service" on public.audit_log_purge_history
  for select to authenticated using (false);

create or replace function public.purge_audit_log()
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_deleted bigint;
begin
  with d as (
    delete from public.audit_log
    where created_at < now() - interval '6 years'
    returning 1
  )
  select count(*) into v_deleted from d;

  insert into public.audit_log_purge_history (rows_deleted) values (v_deleted);
  return v_deleted;
end; $$;

revoke execute on function public.purge_audit_log() from public;
grant execute on function public.purge_audit_log() to service_role;

-- Programmation cron mensuelle (idempotent)
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'audit-ttl-monthly') then
    perform cron.schedule(
      'audit-ttl-monthly',
      '0 3 1 * *',
      $cron$ select public.purge_audit_log(); $cron$
    );
  end if;
exception when undefined_table or undefined_function or insufficient_privilege then
  -- pg_cron pas dispo : skip silencieusement, à activer manuellement.
  null;
end$$;