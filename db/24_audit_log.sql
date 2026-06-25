-- P1.6 — Journal d'audit
-- Idempotent.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  group_id uuid references public.groups(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_group_created_idx
  on public.audit_log (group_id, created_at desc);

grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;

alter table public.audit_log enable row level security;

drop policy if exists "audit_select_organizers" on public.audit_log;
create policy "audit_select_organizers" on public.audit_log
  for select to authenticated
  using (
    group_id is not null
    and public.is_group_organizer(group_id, auth.uid())
  );

create or replace function public.log_audit(
  _group_id uuid,
  _action text,
  _entity_type text default null,
  _entity_id uuid default null,
  _metadata jsonb default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  insert into public.audit_log (actor_user_id, group_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), _group_id, _action, _entity_type, _entity_id, _metadata)
  returning id into v_id;
  return v_id;
end; $$;

grant execute on function public.log_audit(uuid, text, text, uuid, jsonb) to authenticated, service_role;

-- Vue enrichie avec l'acteur
create or replace view public.audit_log_view
with (security_invoker = true) as
select
  a.id, a.group_id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at,
  a.actor_user_id, p.full_name as actor_name
from public.audit_log a
left join public.profiles p on p.id = a.actor_user_id;

grant select on public.audit_log_view to authenticated;
