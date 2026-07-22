
-- ============ db/32 member_admin_actions ============
alter table public.group_members
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists suspended_by     uuid references public.profiles(id) on delete set null,
  add column if not exists removed_at       timestamptz,
  add column if not exists removed_reason   text,
  add column if not exists removed_by       uuid references public.profiles(id) on delete set null;

do $seed$
declare k text;
  kinds text[] := array['member_suspended','member_reactivated','member_kicked','permissions_changed','ownership_transferred'];
begin
  foreach k in array kinds loop
    execute format($f$
      insert into public.notification_preferences (user_id, notif_type, channel, enabled)
      select p.id, %L::public.notification_kind, c.channel, true
      from public.profiles p
      cross join (values ('in_app'::public.notification_channel),('email'::public.notification_channel)) c(channel)
      on conflict (user_id, notif_type, channel) do nothing
    $f$, k);
  end loop;
end $seed$;

-- stub: real version below in db/33
create or replace function public.has_admin_permission(_group uuid, _user uuid, _perm text)
returns boolean language sql stable security definer set search_path = public as $$ select false $$;
grant execute on function public.has_admin_permission(uuid, uuid, text) to authenticated, service_role;

create or replace function public.suspend_member(_member_id uuid, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_member public.group_members%rowtype; v_name text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_member from public.group_members where id = _member_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if not (public.is_group_organizer(v_member.group_id, v_user)
       or public.has_admin_permission(v_member.group_id, v_user, 'can_suspend_member')) then
    raise exception 'FORBIDDEN'; end if;
  if v_member.user_id = v_user then raise exception 'CANNOT_SUSPEND_SELF'; end if;
  if v_member.role = 'organisateur' and exists (select 1 from public.groups
       where id = v_member.group_id and created_by = v_member.user_id) then
    raise exception 'CANNOT_SUSPEND_OWNER'; end if;
  if v_member.status <> 'active' then raise exception 'NOT_ACTIVE'; end if;
  perform set_config('app.via_rpc', '1', true);
  update public.group_members set status='suspended', suspended_at=now(),
     suspended_reason=_reason, suspended_by=v_user where id = _member_id;
  select full_name into v_name from public.profiles where id = v_member.user_id;
  perform public.notify(v_member.user_id, 'member_suspended', 'Compte suspendu',
    coalesce('Votre participation a été suspendue. Motif : ' || _reason,
             'Votre participation a été suspendue par l''organisateur.'),
    v_member.group_id, null, null, jsonb_build_object('reason', _reason));
  perform public.log_audit(v_member.group_id, 'member_suspended', 'group_member', _member_id,
    jsonb_build_object('user_id', v_member.user_id, 'full_name', v_name, 'reason', _reason));
end; $$;
grant execute on function public.suspend_member(uuid, text) to authenticated;

create or replace function public.reactivate_member(_member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_member public.group_members%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_member from public.group_members where id = _member_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if not (public.is_group_organizer(v_member.group_id, v_user)
       or public.has_admin_permission(v_member.group_id, v_user, 'can_suspend_member')) then
    raise exception 'FORBIDDEN'; end if;
  if v_member.status <> 'suspended' then raise exception 'NOT_SUSPENDED'; end if;
  perform set_config('app.via_rpc', '1', true);
  update public.group_members set status='active', suspended_at=null,
     suspended_reason=null, suspended_by=null where id = _member_id;
  perform public.notify(v_member.user_id, 'member_reactivated', 'Compte réactivé',
    'Vous pouvez de nouveau participer pleinement au groupe.',
    v_member.group_id, null, null, null);
  perform public.log_audit(v_member.group_id, 'member_reactivated', 'group_member', _member_id,
    jsonb_build_object('user_id', v_member.user_id));
end; $$;
grant execute on function public.reactivate_member(uuid) to authenticated;

create or replace function public.kick_member(_member_id uuid, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_member public.group_members%rowtype;
  v_name text; v_skipped int := 0;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_member from public.group_members where id = _member_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if not (public.is_group_organizer(v_member.group_id, v_user)
       or public.has_admin_permission(v_member.group_id, v_user, 'can_kick_member')) then
    raise exception 'FORBIDDEN'; end if;
  if v_member.user_id = v_user then raise exception 'CANNOT_KICK_SELF'; end if;
  if exists (select 1 from public.groups where id = v_member.group_id and created_by = v_member.user_id) then
    raise exception 'CANNOT_KICK_OWNER'; end if;
  if v_member.status not in ('active','pending','suspended','invited') then
    raise exception 'ALREADY_REMOVED'; end if;
  perform set_config('app.via_rpc', '1', true);
  update public.group_members set status='removed', removed_at=now(),
     removed_reason=_reason, removed_by=v_user, position=null where id = _member_id;
  update public.turns set status='skipped'
    where group_id = v_member.group_id and beneficiary_user_id = v_member.user_id and status='upcoming';
  get diagnostics v_skipped = row_count;
  select full_name into v_name from public.profiles where id = v_member.user_id;
  perform public.notify(v_member.user_id, 'member_kicked', 'Exclusion du groupe',
    coalesce('Vous avez été exclu du groupe. Motif : ' || _reason,
             'Vous avez été exclu du groupe par l''organisateur.'),
    v_member.group_id, null, null, jsonb_build_object('reason', _reason));
  perform public.log_audit(v_member.group_id, 'member_kicked', 'group_member', _member_id,
    jsonb_build_object('user_id', v_member.user_id, 'full_name', v_name,
                       'reason', _reason, 'turns_skipped', v_skipped));
end; $$;
grant execute on function public.kick_member(uuid, text) to authenticated;

-- ============ db/33 admin_permissions ============
create table if not exists public.group_admin_permissions (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  can_approve_members boolean not null default false,
  can_suspend_member boolean not null default false,
  can_kick_member boolean not null default false,
  can_edit_settings boolean not null default false,
  can_manage_invitations boolean not null default false,
  can_confirm_payments boolean not null default false,
  can_waive_penalty boolean not null default false,
  can_send_announcements boolean not null default false,
  can_pause_cycle boolean not null default false,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
grant select, insert, update, delete on public.group_admin_permissions to authenticated;
grant all on public.group_admin_permissions to service_role;
alter table public.group_admin_permissions enable row level security;

create or replace function public.is_group_owner(_group uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.groups where id = _group and created_by = _user);
$$;
grant execute on function public.is_group_owner(uuid, uuid) to authenticated, service_role;

drop policy if exists "gap_select_members" on public.group_admin_permissions;
create policy "gap_select_members" on public.group_admin_permissions
  for select to authenticated
  using (public.is_group_member(group_id, auth.uid()) or public.is_group_organizer(group_id, auth.uid()));

drop policy if exists "gap_no_direct_write" on public.group_admin_permissions;
create policy "gap_no_direct_write" on public.group_admin_permissions
  for insert to authenticated with check (false);

create or replace function public.has_admin_permission(_group uuid, _user uuid, _perm text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_owner boolean; v_ok boolean := false;
begin
  if _user is null then return false; end if;
  select public.is_group_owner(_group, _user) into v_owner;
  if v_owner then return true; end if;
  execute format('select coalesce((select %I from public.group_admin_permissions
     where group_id = $1 and user_id = $2), false)', _perm) into v_ok using _group, _user;
  return coalesce(v_ok, false);
end; $$;
grant execute on function public.has_admin_permission(uuid, uuid, text) to authenticated, service_role;

create or replace function public.grant_admin_permissions(_group_id uuid, _user_id uuid, _perms jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller uuid := auth.uid(); v_is_member boolean;
begin
  if v_caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_group_owner(_group_id, v_caller) then raise exception 'FORBIDDEN'; end if;
  if _user_id = v_caller then raise exception 'CANNOT_GRANT_SELF'; end if;
  select exists (select 1 from public.group_members where group_id = _group_id and user_id = _user_id and status = 'active') into v_is_member;
  if not v_is_member then raise exception 'NOT_ACTIVE_MEMBER'; end if;
  insert into public.group_admin_permissions as gap
    (group_id, user_id, granted_by, can_approve_members, can_suspend_member, can_kick_member,
     can_edit_settings, can_manage_invitations, can_confirm_payments,
     can_waive_penalty, can_send_announcements, can_pause_cycle)
  values (_group_id, _user_id, v_caller,
     coalesce((_perms->>'can_approve_members')::boolean, false),
     coalesce((_perms->>'can_suspend_member')::boolean, false),
     coalesce((_perms->>'can_kick_member')::boolean, false),
     coalesce((_perms->>'can_edit_settings')::boolean, false),
     coalesce((_perms->>'can_manage_invitations')::boolean, false),
     coalesce((_perms->>'can_confirm_payments')::boolean, false),
     coalesce((_perms->>'can_waive_penalty')::boolean, false),
     coalesce((_perms->>'can_send_announcements')::boolean, false),
     coalesce((_perms->>'can_pause_cycle')::boolean, false))
  on conflict (group_id, user_id) do update set
     can_approve_members=excluded.can_approve_members, can_suspend_member=excluded.can_suspend_member,
     can_kick_member=excluded.can_kick_member, can_edit_settings=excluded.can_edit_settings,
     can_manage_invitations=excluded.can_manage_invitations, can_confirm_payments=excluded.can_confirm_payments,
     can_waive_penalty=excluded.can_waive_penalty, can_send_announcements=excluded.can_send_announcements,
     can_pause_cycle=excluded.can_pause_cycle, updated_at=now();
  perform public.notify(_user_id, 'permissions_changed', 'Permissions mises à jour',
    'Vos droits de co-organisateur ont été modifiés.', _group_id, null, null, _perms);
  perform public.log_audit(_group_id, 'permissions_changed', 'group_admin_permissions', null,
    jsonb_build_object('user_id', _user_id, 'perms', _perms));
end; $$;
grant execute on function public.grant_admin_permissions(uuid, uuid, jsonb) to authenticated;

create or replace function public.revoke_admin_permissions(_group_id uuid, _user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller uuid := auth.uid();
begin
  if v_caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_group_owner(_group_id, v_caller) then raise exception 'FORBIDDEN'; end if;
  delete from public.group_admin_permissions where group_id = _group_id and user_id = _user_id;
  perform public.notify(_user_id, 'permissions_changed', 'Droits de co-organisateur retirés',
    'Vous n''êtes plus co-organisateur de ce groupe.', _group_id, null, null, null);
  perform public.log_audit(_group_id, 'permissions_revoked', 'group_admin_permissions', null,
    jsonb_build_object('user_id', _user_id));
end; $$;
grant execute on function public.revoke_admin_permissions(uuid, uuid) to authenticated;

create or replace function public.transfer_ownership(_group_id uuid, _new_owner_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller uuid := auth.uid(); v_old_owner uuid; v_old_member_id uuid; v_new_member_id uuid;
begin
  if v_caller is null then raise exception 'AUTH_REQUIRED'; end if;
  select created_by into v_old_owner from public.groups where id = _group_id;
  if v_old_owner is null then raise exception 'GROUP_NOT_FOUND'; end if;
  if v_old_owner <> v_caller then raise exception 'FORBIDDEN'; end if;
  if _new_owner_user_id = v_caller then raise exception 'SAME_OWNER'; end if;
  select id into v_new_member_id from public.group_members
    where group_id = _group_id and user_id = _new_owner_user_id and status = 'active';
  if v_new_member_id is null then raise exception 'NEW_OWNER_NOT_ACTIVE_MEMBER'; end if;
  select id into v_old_member_id from public.group_members
    where group_id = _group_id and user_id = v_old_owner and status = 'active';
  perform set_config('app.via_rpc', '1', true);
  update public.group_members set role='organisateur' where id = v_new_member_id;
  update public.groups set created_by=_new_owner_user_id, updated_at=now() where id = _group_id;
  insert into public.group_admin_permissions as gap
    (group_id, user_id, granted_by, can_approve_members, can_suspend_member, can_kick_member,
     can_edit_settings, can_manage_invitations, can_confirm_payments,
     can_waive_penalty, can_send_announcements, can_pause_cycle)
  values (_group_id, v_old_owner, _new_owner_user_id, true,true,true,true,true,true,true,true,true)
  on conflict (group_id, user_id) do update set
     can_approve_members=true, can_suspend_member=true, can_kick_member=true,
     can_edit_settings=true, can_manage_invitations=true,
     can_confirm_payments=true, can_waive_penalty=true,
     can_send_announcements=true, can_pause_cycle=true, updated_at=now();
  delete from public.group_admin_permissions where group_id = _group_id and user_id = _new_owner_user_id;
  perform public.notify(_new_owner_user_id, 'ownership_transferred',
    'Vous êtes le nouveau propriétaire', 'La propriété du groupe vous a été transférée.',
    _group_id, null, null, null);
  perform public.notify(v_old_owner, 'ownership_transferred',
    'Propriété transférée', 'Vous avez transféré la propriété. Vous restez co-organisateur avec tous les droits.',
    _group_id, null, null, null);
  perform public.log_audit(_group_id, 'ownership_transferred', 'group', _group_id,
    jsonb_build_object('from', v_old_owner, 'to', _new_owner_user_id));
end; $$;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;

create or replace view public.group_admin_permissions_view as
select gap.*, p.full_name, p.phone_number
from public.group_admin_permissions gap
left join public.profiles p on p.id = gap.user_id;
grant select on public.group_admin_permissions_view to authenticated;

comment on column public.groups.co_organizers is
  'DEPRECATED : utiliser public.group_admin_permissions (Phase B3).';

-- ============ db/34 member_permissions ============
alter table public.group_members
  add column if not exists can_chat boolean not null default true,
  add column if not exists can_bid boolean not null default true,
  add column if not exists can_swap boolean not null default true,
  add column if not exists can_invite boolean not null default false;

create or replace function public.set_member_permissions(_member_id uuid, _perms jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_member public.group_members%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_member from public.group_members where id = _member_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if not (public.is_group_organizer(v_member.group_id, v_user)
       or public.has_admin_permission(v_member.group_id, v_user, 'can_suspend_member')) then
    raise exception 'FORBIDDEN'; end if;
  update public.group_members set
    can_chat   = coalesce((_perms->>'can_chat')::boolean,   can_chat),
    can_bid    = coalesce((_perms->>'can_bid')::boolean,    can_bid),
    can_swap   = coalesce((_perms->>'can_swap')::boolean,   can_swap),
    can_invite = coalesce((_perms->>'can_invite')::boolean, can_invite)
  where id = _member_id;
  perform public.notify(v_member.user_id, 'permissions_changed',
    'Vos droits ont été mis à jour',
    'Vos permissions dans le groupe ont été modifiées par un organisateur.',
    v_member.group_id, null, null, _perms);
  perform public.log_audit(v_member.group_id, 'member_permissions_changed', 'group_member', _member_id,
    jsonb_build_object('user_id', v_member.user_id, 'perms', _perms));
end; $$;
grant execute on function public.set_member_permissions(uuid, jsonb) to authenticated;

drop policy if exists "chat_insert_members" on public.group_messages;
create policy "chat_insert_members" on public.group_messages
  for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (select 1 from public.group_members gm
      where gm.group_id = group_messages.group_id and gm.user_id = auth.uid()
        and gm.status = 'active' and gm.can_chat = true));

create or replace function public.member_can(_group uuid, _user uuid, _flag text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_ok boolean;
begin
  if _user is null then return false; end if;
  execute format('select coalesce((select %I from public.group_members
     where group_id = $1 and user_id = $2 and status = ''active''), false)', _flag)
  into v_ok using _group, _user;
  return coalesce(v_ok, false);
end; $$;
grant execute on function public.member_can(uuid, uuid, text) to authenticated, service_role;

-- Patch place_bid (with can_bid check)
create or replace function public.place_bid(_turn_id uuid, _amount bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_turn public.turns%rowtype; v_group public.groups%rowtype;
  v_my_turn public.turns%rowtype; v_current_max bigint; v_bid_id uuid; r record;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_turn from public.turns where id = _turn_id;
  if not found then raise exception 'TURN_NOT_FOUND'; end if;
  if v_turn.status <> 'upcoming' then raise exception 'TURN_NOT_UPCOMING'; end if;
  select * into v_group from public.groups where id = v_turn.group_id;
  if v_group.rotation_order_kind <> 'auction' then raise exception 'AUCTION_DISABLED'; end if;
  if not public.is_group_member(v_turn.group_id, v_user) then raise exception 'NOT_A_MEMBER'; end if;
  if not public.member_can(v_turn.group_id, v_user, 'can_bid') then raise exception 'BID_PERMISSION_REVOKED'; end if;
  if v_turn.beneficiary_user_id = v_user then raise exception 'ALREADY_BENEFICIARY'; end if;
  select * into v_my_turn from public.turns
    where cycle_id = v_turn.cycle_id and beneficiary_user_id = v_user
      and status = 'upcoming' and turn_number > v_turn.turn_number
    order by turn_number asc limit 1;
  if not found then raise exception 'NO_LATER_TURN_TO_TRADE'; end if;
  if _amount < 1 then raise exception 'INVALID_AMOUNT'; end if;
  select coalesce(max(amount), 0) into v_current_max from public.turn_bids where turn_id = _turn_id and status = 'active';
  if _amount <= v_current_max then raise exception 'BID_TOO_LOW'; end if;
  if exists (select 1 from public.turn_bids where turn_id = _turn_id and bidder_user_id = v_user and status='active') then
    update public.turn_bids set amount = _amount, updated_at = now()
    where turn_id = _turn_id and bidder_user_id = v_user and status='active' returning id into v_bid_id;
  else
    insert into public.turn_bids (group_id, turn_id, cycle_id, bidder_user_id, amount)
    values (v_turn.group_id, _turn_id, v_turn.cycle_id, v_user, _amount) returning id into v_bid_id;
  end if;
  for r in select distinct bidder_user_id from public.turn_bids
    where turn_id = _turn_id and status='active' and bidder_user_id <> v_user
  loop
    if public.should_notify(r.bidder_user_id, 'auction_outbid', 'in_app') then
      perform public.notify(r.bidder_user_id, 'auction_outbid', 'Vous avez été surenchéri',
        'Une enchère supérieure a été placée sur le tour #' || v_turn.turn_number || '.',
        v_turn.group_id, _turn_id, null, jsonb_build_object('amount', _amount));
    end if;
  end loop;
  perform public.log_audit(v_turn.group_id, 'auction.bid', 'turn_bid', v_bid_id,
    jsonb_build_object('turn_id', _turn_id, 'amount', _amount));
  return v_bid_id;
end; $$;
grant execute on function public.place_bid(uuid, bigint) to authenticated;

-- Patch request_turn_swap (with can_swap check)
create or replace function public.request_turn_swap(_from_turn uuid, _to_turn uuid, _reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_from public.turns%rowtype; v_to public.turns%rowtype;
  v_policy public.swap_policy; v_is_org boolean; v_req_id uuid; v_group_name text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_from from public.turns where id = _from_turn;
  if not found then raise exception 'FROM_TURN_NOT_FOUND'; end if;
  select * into v_to from public.turns where id = _to_turn;
  if not found then raise exception 'TO_TURN_NOT_FOUND'; end if;
  if v_from.group_id <> v_to.group_id then raise exception 'CROSS_GROUP_SWAP_FORBIDDEN'; end if;
  if v_from.cycle_id <> v_to.cycle_id then raise exception 'CROSS_CYCLE_SWAP_FORBIDDEN'; end if;
  if v_from.status <> 'upcoming' or v_to.status <> 'upcoming' then raise exception 'TURN_NOT_UPCOMING'; end if;
  if v_from.beneficiary_user_id <> v_user then raise exception 'NOT_FROM_BENEFICIARY'; end if;
  if v_to.beneficiary_user_id = v_user then raise exception 'SAME_BENEFICIARY'; end if;
  if not public.member_can(v_from.group_id, v_user, 'can_swap') then raise exception 'SWAP_PERMISSION_REVOKED'; end if;
  select swap_policy into v_policy from public.groups where id = v_from.group_id;
  v_is_org := public.is_group_organizer(v_from.group_id, v_user);
  if v_policy = 'none' then raise exception 'SWAPS_DISABLED'; end if;
  if v_policy = 'organizer_only' and not v_is_org then raise exception 'ORGANIZER_ONLY_SWAPS'; end if;
  insert into public.turn_swap_requests (group_id, from_turn_id, to_turn_id, from_user_id, to_user_id, reason)
  values (v_from.group_id, _from_turn, _to_turn, v_user, v_to.beneficiary_user_id, _reason)
  returning id into v_req_id;
  select name into v_group_name from public.groups where id = v_from.group_id;
  if public.should_notify(v_to.beneficiary_user_id, 'swap_requested', 'in_app') then
    perform public.notify(v_to.beneficiary_user_id, 'swap_requested', 'Demande d''échange de tour',
      'Un membre de ' || coalesce(v_group_name,'votre groupe') || ' propose d''échanger son tour avec le vôtre.',
      v_from.group_id, _from_turn, null, jsonb_build_object('request_id', v_req_id));
  end if;
  perform public.log_audit(v_from.group_id, 'swap.request', 'turn_swap_request', v_req_id,
    jsonb_build_object('from_turn', _from_turn, 'to_turn', _to_turn,
                       'from_user', v_user, 'to_user', v_to.beneficiary_user_id));
  return v_req_id;
end; $$;
grant execute on function public.request_turn_swap(uuid, uuid, text) to authenticated;
