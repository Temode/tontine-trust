
create or replace function public.is_super_admin(_uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _uid and role = 'super_admin'
  );
$$;
revoke all on function public.is_super_admin(uuid) from public, anon;
grant execute on function public.is_super_admin(uuid) to authenticated, service_role;

alter table public.groups
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_request_id uuid;

create table if not exists public.group_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  reason text not null,
  status public.deletion_request_status not null default 'pending_members',
  members_deadline timestamptz not null,
  admin_decision_by uuid references auth.users(id),
  admin_decision_at timestamptz,
  admin_decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_gdr_group on public.group_deletion_requests(group_id);
create index if not exists idx_gdr_status on public.group_deletion_requests(status);
create unique index if not exists uq_gdr_one_active_per_group
  on public.group_deletion_requests(group_id)
  where status in ('pending_members','pending_admin');

grant select on public.group_deletion_requests to authenticated;
grant all on public.group_deletion_requests to service_role;
alter table public.group_deletion_requests enable row level security;

drop policy if exists "members read deletion requests of their group" on public.group_deletion_requests;
create policy "members read deletion requests of their group"
  on public.group_deletion_requests for select to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_deletion_requests.group_id
        and gm.user_id = auth.uid()
        and gm.status in ('active','suspended')
    )
    or public.is_super_admin(auth.uid())
  );

create table if not exists public.group_deletion_votes (
  request_id uuid not null references public.group_deletion_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  vote public.deletion_vote_choice not null,
  voted_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
grant select on public.group_deletion_votes to authenticated;
grant all on public.group_deletion_votes to service_role;
alter table public.group_deletion_votes enable row level security;

drop policy if exists "members read votes of their group request" on public.group_deletion_votes;
create policy "members read votes of their group request"
  on public.group_deletion_votes for select to authenticated
  using (
    exists (
      select 1 from public.group_deletion_requests r
      join public.group_members gm on gm.group_id = r.group_id
      where r.id = group_deletion_votes.request_id
        and gm.user_id = auth.uid()
        and gm.status in ('active','suspended')
    )
    or public.is_super_admin(auth.uid())
  );

create or replace function public.request_group_deletion(
  _group_id uuid,
  _reason text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_g public.groups%rowtype;
  v_open_turns int;
  v_pending_contribs int;
  v_pending_links int;
  v_req_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(_reason,'') = '' then raise exception 'REASON_REQUIRED'; end if;

  select * into v_g from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if v_g.deleted_at is not null then raise exception 'ALREADY_DELETED'; end if;
  if v_g.created_by <> v_uid then raise exception 'FORBIDDEN'; end if;

  select count(*) into v_open_turns from public.turns
    where group_id = _group_id and status = 'collecting';
  if v_open_turns > 0 then raise exception 'OPEN_TURNS_REMAIN'; end if;

  select count(*) into v_pending_contribs from public.contributions
    where group_id = _group_id and status = 'pending';
  if v_pending_contribs > 0 then raise exception 'PENDING_CONTRIBUTIONS'; end if;

  select count(*) into v_pending_links from public.payment_links pl
    join public.contributions c on c.id = pl.contribution_id
    where c.group_id = _group_id and pl.status = 'pending';
  if v_pending_links > 0 then raise exception 'PENDING_PAYMENT_LINKS'; end if;

  if exists (
    select 1 from public.group_deletion_requests
    where group_id = _group_id and status in ('pending_members','pending_admin')
  ) then
    raise exception 'REQUEST_ALREADY_OPEN';
  end if;

  insert into public.group_deletion_requests(group_id, requested_by, reason, members_deadline)
    values (_group_id, v_uid, _reason, now() + interval '14 days')
    returning id into v_req_id;

  insert into public.group_deletion_votes(request_id, user_id, vote)
    values (v_req_id, v_uid, 'yes');

  insert into public.notifications(user_id, kind, title, body, group_id, data)
  select gm.user_id, 'group_deletion_requested',
         'Demande de suppression du groupe',
         'L''organisateur de "' || v_g.name || '" demande la suppression du groupe. Vous avez 14 jours pour vous opposer.',
         _group_id,
         jsonb_build_object('request_id', v_req_id, 'deadline', now() + interval '14 days', 'reason', _reason)
  from public.group_members gm
  where gm.group_id = _group_id
    and gm.status = 'active'
    and gm.user_id <> v_uid;

  perform public.log_audit(_group_id, 'deletion_requested', 'group_deletion_request', v_req_id,
    jsonb_build_object('reason', _reason));

  return v_req_id;
end; $$;
revoke all on function public.request_group_deletion(uuid, text) from public, anon;
grant execute on function public.request_group_deletion(uuid, text) to authenticated;

create or replace function public.vote_group_deletion(
  _request_id uuid,
  _vote public.deletion_vote_choice
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.group_deletion_requests%rowtype;
  v_g public.groups%rowtype;
  v_is_member boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_req from public.group_deletion_requests where id = _request_id;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status <> 'pending_members' then raise exception 'VOTE_CLOSED'; end if;

  select exists (
    select 1 from public.group_members
    where group_id = v_req.group_id and user_id = v_uid and status = 'active'
  ) into v_is_member;
  if not v_is_member then raise exception 'NOT_A_MEMBER'; end if;

  insert into public.group_deletion_votes(request_id, user_id, vote)
    values (_request_id, v_uid, _vote)
  on conflict (request_id, user_id) do update
    set vote = excluded.vote, voted_at = now();

  select * into v_g from public.groups where id = v_req.group_id;

  if _vote = 'no' then
    update public.group_deletion_requests
      set status = 'rejected', updated_at = now()
      where id = _request_id;

    insert into public.notifications(user_id, kind, title, body, group_id, data)
      values (v_req.requested_by, 'group_deletion_rejected_by_member',
              'Demande de suppression refusée',
              'Un membre s''est opposé à la suppression de "' || v_g.name || '". La demande est annulée.',
              v_req.group_id, jsonb_build_object('request_id', _request_id));

    perform public.log_audit(v_req.group_id, 'deletion_voted', 'group_deletion_request', _request_id,
      jsonb_build_object('vote','no','outcome','rejected'));
  else
    insert into public.notifications(user_id, kind, title, body, group_id, data)
      values (v_req.requested_by, 'group_deletion_vote_recorded',
              'Vote enregistré',
              'Un membre a approuvé la suppression de "' || v_g.name || '".',
              v_req.group_id, jsonb_build_object('request_id', _request_id));

    perform public.log_audit(v_req.group_id, 'deletion_voted', 'group_deletion_request', _request_id,
      jsonb_build_object('vote','yes'));
  end if;
end; $$;
revoke all on function public.vote_group_deletion(uuid, public.deletion_vote_choice) from public, anon;
grant execute on function public.vote_group_deletion(uuid, public.deletion_vote_choice) to authenticated;

create or replace function public.finalize_deletion_votes()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_g public.groups%rowtype;
  v_count int := 0;
begin
  for r in
    select * from public.group_deletion_requests
    where status = 'pending_members' and members_deadline <= now()
  loop
    update public.group_deletion_requests
      set status = 'pending_admin', updated_at = now()
      where id = r.id;

    select * into v_g from public.groups where id = r.group_id;

    insert into public.notifications(user_id, kind, title, body, group_id, data)
      values (r.requested_by, 'group_deletion_pending_admin',
              'Suppression en attente de validation Tontine',
              'La période de consultation pour "' || v_g.name || '" est écoulée sans opposition. Tontine va statuer.',
              r.group_id, jsonb_build_object('request_id', r.id));

    insert into public.notifications(user_id, kind, title, body, group_id, data)
    select ur.user_id, 'group_deletion_pending_admin',
           'Demande de suppression à examiner',
           'Le groupe "' || v_g.name || '" attend votre décision.',
           r.group_id, jsonb_build_object('request_id', r.id)
    from public.user_roles ur where ur.role = 'super_admin';

    perform public.log_audit(r.group_id, 'deletion_finalized', 'group_deletion_request', r.id,
      jsonb_build_object('promoted_to','pending_admin'));
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;
revoke all on function public.finalize_deletion_votes() from public, anon;
grant execute on function public.finalize_deletion_votes() to service_role;

create or replace function public.admin_decide_deletion(
  _request_id uuid,
  _approve boolean,
  _reason text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.group_deletion_requests%rowtype;
  v_g public.groups%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_super_admin(v_uid) then raise exception 'FORBIDDEN'; end if;

  select * into v_req from public.group_deletion_requests where id = _request_id;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status <> 'pending_admin' then raise exception 'NOT_PENDING_ADMIN'; end if;

  select * into v_g from public.groups where id = v_req.group_id;

  update public.group_deletion_requests
    set status = case when _approve then 'approved'::deletion_request_status else 'rejected'::deletion_request_status end,
        admin_decision_by = v_uid,
        admin_decision_at = now(),
        admin_decision_reason = _reason,
        updated_at = now()
    where id = _request_id;

  if _approve then
    update public.groups
      set deleted_at = now(),
          deletion_request_id = _request_id,
          status = 'cancelled'
      where id = v_req.group_id;
  end if;

  insert into public.notifications(user_id, kind, title, body, group_id, data)
  select gm.user_id,
         case when _approve then 'group_deletion_approved' else 'group_deletion_refused' end,
         case when _approve then 'Groupe supprimé' else 'Suppression refusée' end,
         case when _approve
              then 'Tontine a approuvé la suppression de "' || v_g.name || '". L''historique reste archivé pour 6 ans.'
              else 'Tontine a refusé la suppression de "' || v_g.name || '"' || coalesce(' : ' || _reason, '.') end,
         v_req.group_id,
         jsonb_build_object('request_id', _request_id, 'reason', _reason)
  from public.group_members gm
  where gm.group_id = v_req.group_id and gm.status in ('active','suspended');

  perform public.log_audit(v_req.group_id, 'deletion_admin_decision', 'group_deletion_request', _request_id,
    jsonb_build_object('approved', _approve, 'reason', _reason));
end; $$;
revoke all on function public.admin_decide_deletion(uuid, boolean, text) from public, anon;
grant execute on function public.admin_decide_deletion(uuid, boolean, text) to authenticated;

create or replace view public.deletion_requests_admin_view
with (security_invoker = true)
as
select
  r.id,
  r.group_id,
  g.name as group_name,
  g.contribution_amount,
  g.frequency,
  g.max_members,
  r.requested_by,
  prof.full_name as requester_name,
  r.reason,
  r.status,
  r.members_deadline,
  r.admin_decision_by,
  r.admin_decision_at,
  r.admin_decision_reason,
  r.created_at,
  (select count(*) from public.group_deletion_votes v
    where v.request_id = r.id and v.vote = 'yes') as yes_votes,
  (select count(*) from public.group_deletion_votes v
    where v.request_id = r.id and v.vote = 'no') as no_votes,
  (select count(*) from public.group_members gm
    where gm.group_id = r.group_id and gm.status = 'active') as active_members
from public.group_deletion_requests r
join public.groups g on g.id = r.group_id
left join public.profiles prof on prof.id = r.requested_by;

grant select on public.deletion_requests_admin_view to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'finalize-deletion-votes-daily';
    perform cron.schedule(
      'finalize-deletion-votes-daily',
      '0 3 * * *',
      'select public.finalize_deletion_votes();'
    );
  end if;
end$$;

notify pgrst, 'reload schema';
