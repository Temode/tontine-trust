drop function if exists public.join_group_with_code(text, text, text, text);

create function public.join_group_with_code(
  _code text, _operator text, _message text, _accepted_terms_version text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_invitation public.invitations%rowtype;
  v_user uuid := auth.uid();
  v_count int; v_max int; v_attempt_count int;
  v_ip_hash text; v_member_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if _accepted_terms_version is null or _accepted_terms_version = '' then raise exception 'TERMS_REQUIRED'; end if;
  if not exists (select 1 from public.app_terms_versions where version = _accepted_terms_version) then raise exception 'TERMS_VERSION_UNKNOWN'; end if;
  select count(*) into v_attempt_count from public.join_attempts where user_id = v_user and attempted_at > now() - interval '10 minutes';
  if v_attempt_count >= 10 then raise exception 'RATE_LIMITED'; end if;
  insert into public.join_attempts (user_id) values (v_user);
  if _operator is not null and _operator not in ('orange','mtn') then raise exception 'INVALID_OPERATOR'; end if;
  if _message is not null and char_length(_message) > 280 then raise exception 'MESSAGE_TOO_LONG'; end if;
  select * into v_invitation from public.invitations where code = _code;
  if not found then raise exception 'INVITATION_NOT_FOUND'; end if;
  if v_invitation.status <> 'pending' then raise exception 'INVITATION_INACTIVE'; end if;
  if v_invitation.expires_at is not null and v_invitation.expires_at < now() then
    update public.invitations set status='expired' where id=v_invitation.id;
    raise exception 'INVITATION_EXPIRED'; end if;
  if v_invitation.max_uses is not null and v_invitation.uses_count >= v_invitation.max_uses then raise exception 'INVITATION_EXHAUSTED'; end if;
  select max_members into v_max from public.groups where id=v_invitation.group_id;
  select count(*) into v_count from public.group_members where group_id=v_invitation.group_id and status='active';
  if v_count >= v_max then raise exception 'GROUP_FULL'; end if;

  insert into public.group_members (group_id, user_id, role, status, position, preferred_operator, applicant_message)
  values (v_invitation.group_id, v_user, 'membre', 'pending'::public.member_status, null, _operator, _message)
  on conflict (group_id, user_id) do update set
    status = case when public.group_members.status in ('active','pending')
                  then public.group_members.status else 'pending'::public.member_status end,
    preferred_operator = coalesce(excluded.preferred_operator, public.group_members.preferred_operator),
    applicant_message = coalesce(excluded.applicant_message, public.group_members.applicant_message)
  returning id into v_member_id;

  update public.invitations set uses_count = uses_count + 1 where id=v_invitation.id;
  begin v_ip_hash := encode(digest(coalesce(current_setting('request.headers',true)::jsonb->>'x-forwarded-for',''),'sha256'),'hex');
  exception when others then v_ip_hash := null; end;
  begin
    insert into public.group_consent_log (group_id, user_id, terms_version, ip_hash)
    values (v_invitation.group_id, v_user, _accepted_terms_version, v_ip_hash) on conflict do nothing;
  exception when others then null; end;

  insert into public.notifications (user_id, kind, title, body, group_id)
  select g.created_by, 'member_joined', 'Nouvelle candidature',
    'Une nouvelle demande d''adhésion attend votre validation.', v_invitation.group_id
  from public.groups g where g.id=v_invitation.group_id;
  return v_member_id;
end; $$;
grant execute on function public.join_group_with_code(text,text,text,text) to authenticated;

create or replace function public.start_cycle(_group_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid(); v_group public.groups%rowtype;
  v_count int; v_cycle_id uuid; v_cycle_number int;
  v_freq_days int; v_payout bigint; v_due date; r record;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_group from public.groups where id=_group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if not public.is_group_organizer(_group_id, v_user) then raise exception 'FORBIDDEN'; end if;
  if v_group.status not in ('draft','open') then raise exception 'CYCLE_ALREADY_STARTED'; end if;
  select count(*) into v_count from public.group_members where group_id=_group_id and status='active';
  if v_count < 2 then raise exception 'QUORUM_NOT_REACHED'; end if;
  v_freq_days := case v_group.frequency when 'hebdomadaire' then 7 when 'quinzaine' then 14 when 'mensuelle' then 30 else null end;
  if v_freq_days is null then raise exception 'INVALID_FREQUENCY: %', v_group.frequency; end if;
  if v_group.rotation_order_kind='random' then
    with shuffled as (select id,row_number() over (order by random()) as rn from public.group_members where group_id=_group_id and status='active')
    update public.group_members gm set position=s.rn from shuffled s where gm.id=s.id;
  else
    with ordered as (select id,row_number() over (order by position nulls last, joined_at) as rn from public.group_members where group_id=_group_id and status='active')
    update public.group_members gm set position=o.rn from ordered o where gm.id=o.id;
  end if;
  select coalesce(max(cycle_number),0)+1 into v_cycle_number from public.cycles where group_id=_group_id;
  insert into public.cycles (group_id, cycle_number, started_at) values (_group_id, v_cycle_number, now()) returning id into v_cycle_id;
  v_payout := v_group.contribution_amount * v_count;
  v_due := current_date + v_freq_days;
  for r in select user_id, position from public.group_members where group_id=_group_id and status='active' order by position loop
    insert into public.turns (cycle_id, group_id, beneficiary_user_id, turn_number, due_date, payout_amount, status)
    values (v_cycle_id, _group_id, r.user_id, r.position, v_due, v_payout,
      (case when r.position=1 then 'collecting' else 'upcoming' end)::public.turn_status);
    insert into public.contributions (turn_id, group_id, payer_user_id, amount, status)
    select (select id from public.turns where cycle_id=v_cycle_id and turn_number=r.position),
      _group_id, gm.user_id, v_group.contribution_amount, 'pending'::public.contribution_status
    from public.group_members gm where gm.group_id=_group_id and gm.status='active' and gm.user_id<>r.user_id;
    v_due := v_due + v_freq_days;
  end loop;
  update public.groups set status='active' where id=_group_id;
  insert into public.notifications (user_id, kind, title, body, group_id)
  select gm.user_id,'cycle_started','Cycle démarré','L''ordre de rotation a été tiré. Premier tour planifié.',_group_id
  from public.group_members gm where gm.group_id=_group_id and gm.status='active';
  begin
    perform public.log_audit(_group_id,'start_cycle','cycle',v_cycle_id,
      jsonb_build_object('members_count',v_count,'total_turns',v_count,'payout_amount',v_payout));
  exception when others then null; end;
  return v_cycle_id;
end; $$;
grant execute on function public.start_cycle(uuid) to authenticated;

drop view if exists public.admin_user_overview;
create view public.admin_user_overview as
select p.id, p.full_name, p.phone_number, p.avatar_url, p.reliability_score,
       p.created_at, p.suspended_at, p.deleted_at,
       (select array_agg(role::text) from public.user_roles where user_id=p.id) as roles,
       (select count(*) from public.group_members where user_id=p.id and removed_at is null) as groups_count,
       u.email
from public.profiles p left join auth.users u on u.id=p.id
where public.has_role(auth.uid(),'super_admin');
grant select on public.admin_user_overview to authenticated;

drop view if exists public.admin_group_overview;
create view public.admin_group_overview as
select g.id, g.name, g.status::text, g.contribution_amount, g.frequency::text,
       g.max_members, g.created_at, g.created_by, g.deleted_at, g.paused_at, g.archived_at,
       (select full_name from public.profiles where id=g.created_by) as organizer_name,
       (select count(*) from public.group_members where group_id=g.id and status='active') as members_count,
       coalesce((select sum(amount) from public.contributions where group_id=g.id and status='confirmed'),0) as volume_total
from public.groups g
where public.has_role(auth.uid(),'super_admin');
grant select on public.admin_group_overview to authenticated;

drop view if exists public.admin_payment_overview;
create view public.admin_payment_overview as
select pay.id, pay.group_id, pay.user_id, pay.amount, pay.status::text,
       pay.provider, pay.payment_method, pay.djomy_transaction_id, pay.error_message,
       pay.initiated_at, pay.settled_at,
       (select name from public.groups where id=pay.group_id) as group_name,
       (select full_name from public.profiles where id=pay.user_id) as payer_name
from public.payments pay
where public.has_role(auth.uid(),'super_admin');
grant select on public.admin_payment_overview to authenticated;

drop view if exists public.admin_platform_kpis;
create view public.admin_platform_kpis as
select
  (select count(*) from public.profiles where public.has_role(auth.uid(),'super_admin')) as users_total,
  (select count(*) from public.profiles where created_at > now() - interval '7 days' and public.has_role(auth.uid(),'super_admin')) as users_new_7d,
  (select count(*) from public.groups where status='active' and public.has_role(auth.uid(),'super_admin')) as groups_active,
  (select count(*) from public.groups where public.has_role(auth.uid(),'super_admin')) as groups_total,
  (select count(*) from public.cycles where ended_at is null and public.has_role(auth.uid(),'super_admin')) as cycles_open,
  coalesce((select sum(amount) from public.contributions where status='confirmed' and confirmed_at > now() - interval '30 days' and public.has_role(auth.uid(),'super_admin')),0) as volume_30d,
  (select count(*) from public.payments where status='failed' and initiated_at > now() - interval '7 days' and public.has_role(auth.uid(),'super_admin')) as payment_failures_7d,
  (select count(*) from public.group_deletion_requests where status in ('pending_members','pending_admin') and public.has_role(auth.uid(),'super_admin')) as deletion_requests_open,
  coalesce((select avg(reliability_score)::int from public.profiles where public.has_role(auth.uid(),'super_admin')),0) as reliability_avg;
grant select on public.admin_platform_kpis to authenticated;