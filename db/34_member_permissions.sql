-- =====================================================================
-- Phase B4 — Permissions fines par membre (chat / enchères / swaps / invite)
-- Prérequis : db/33_admin_permissions.sql.
-- Idempotent.
-- =====================================================================

alter table public.group_members
  add column if not exists can_chat   boolean not null default true,
  add column if not exists can_bid    boolean not null default true,
  add column if not exists can_swap   boolean not null default true,
  add column if not exists can_invite boolean not null default false;

-- 1. RPC : set_member_permissions
create or replace function public.set_member_permissions(
  _member_id uuid,
  _perms     jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_member public.group_members%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_member from public.group_members where id = _member_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;

  if not (
    public.is_group_organizer(v_member.group_id, v_user)
    or public.has_admin_permission(v_member.group_id, v_user, 'can_suspend_member')
  ) then
    raise exception 'FORBIDDEN';
  end if;

  update public.group_members set
    can_chat   = coalesce((_perms->>'can_chat')::boolean,   can_chat),
    can_bid    = coalesce((_perms->>'can_bid')::boolean,    can_bid),
    can_swap   = coalesce((_perms->>'can_swap')::boolean,   can_swap),
    can_invite = coalesce((_perms->>'can_invite')::boolean, can_invite)
  where id = _member_id;

  perform public.notify(
    v_member.user_id, 'permissions_changed',
    'Vos droits ont été mis à jour',
    'Vos permissions dans le groupe ont été modifiées par un organisateur.',
    v_member.group_id, null, null, _perms
  );
  perform public.log_audit(
    v_member.group_id, 'member_permissions_changed', 'group_member', _member_id,
    jsonb_build_object('user_id', v_member.user_id, 'perms', _perms)
  );
end; $$;
grant execute on function public.set_member_permissions(uuid, jsonb) to authenticated;

-- 2. Effet sur chat : refuse l'insert si can_chat=false
drop policy if exists "chat_insert_members" on public.group_messages;
create policy "chat_insert_members" on public.group_messages
  for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = group_messages.group_id
        and gm.user_id  = auth.uid()
        and gm.status   = 'active'
        and gm.can_chat = true
    )
  );

-- 3. Helper exposé pour les RPC d'enchère / swap (vérifs côté serveur).
create or replace function public.member_can(_group uuid, _user uuid, _flag text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_ok boolean;
begin
  if _user is null then return false; end if;
  execute format(
    'select coalesce((select %I from public.group_members
                       where group_id = $1 and user_id = $2 and status = ''active''), false)',
    _flag
  ) into v_ok using _group, _user;
  return coalesce(v_ok, false);
end; $$;
grant execute on function public.member_can(uuid, uuid, text) to authenticated, service_role;

-- 4. Patch place_bid : refuse si !can_bid
create or replace function public.place_bid(
  _turn_id uuid,
  _amount  bigint
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_turn public.turns%rowtype;
  v_group public.groups%rowtype;
  v_my_turn public.turns%rowtype;
  v_current_max bigint;
  v_bid_id uuid;
  r record;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_turn from public.turns where id = _turn_id;
  if not found then raise exception 'TURN_NOT_FOUND'; end if;
  if v_turn.status <> 'upcoming' then raise exception 'TURN_NOT_UPCOMING'; end if;

  select * into v_group from public.groups where id = v_turn.group_id;
  if v_group.rotation_order_kind <> 'auction' then
    raise exception 'AUCTION_DISABLED';
  end if;

  if not public.is_group_member(v_turn.group_id, v_user) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if not public.member_can(v_turn.group_id, v_user, 'can_bid') then
    raise exception 'BID_PERMISSION_REVOKED';
  end if;
  if v_turn.beneficiary_user_id = v_user then
    raise exception 'ALREADY_BENEFICIARY';
  end if;

  select * into v_my_turn from public.turns
    where cycle_id = v_turn.cycle_id
      and beneficiary_user_id = v_user
      and status = 'upcoming'
      and turn_number > v_turn.turn_number
    order by turn_number asc limit 1;
  if not found then raise exception 'NO_LATER_TURN_TO_TRADE'; end if;

  if _amount < 1 then raise exception 'INVALID_AMOUNT'; end if;
  select coalesce(max(amount), 0) into v_current_max
    from public.turn_bids where turn_id = _turn_id and status = 'active';
  if _amount <= v_current_max then raise exception 'BID_TOO_LOW'; end if;

  if exists (select 1 from public.turn_bids
             where turn_id = _turn_id and bidder_user_id = v_user and status='active') then
    update public.turn_bids set amount = _amount, updated_at = now()
    where turn_id = _turn_id and bidder_user_id = v_user and status='active'
    returning id into v_bid_id;
  else
    insert into public.turn_bids (group_id, turn_id, cycle_id, bidder_user_id, amount)
    values (v_turn.group_id, _turn_id, v_turn.cycle_id, v_user, _amount)
    returning id into v_bid_id;
  end if;

  for r in
    select distinct bidder_user_id from public.turn_bids
    where turn_id = _turn_id and status='active' and bidder_user_id <> v_user
  loop
    if public.should_notify(r.bidder_user_id, 'auction_outbid', 'in_app') then
      perform public.notify(
        r.bidder_user_id, 'auction_outbid',
        'Vous avez été surenchéri',
        'Une enchère supérieure a été placée sur le tour #' || v_turn.turn_number || '.',
        v_turn.group_id, _turn_id, null,
        jsonb_build_object('amount', _amount)
      );
    end if;
  end loop;

  perform public.log_audit(
    v_turn.group_id, 'auction.bid', 'turn_bid', v_bid_id,
    jsonb_build_object('turn_id', _turn_id, 'amount', _amount)
  );
  return v_bid_id;
end; $$;
grant execute on function public.place_bid(uuid, bigint) to authenticated;

-- 5. Patch request_turn_swap : refuse si !can_swap
create or replace function public.request_turn_swap(
  _from_turn uuid,
  _to_turn uuid,
  _reason text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_from public.turns%rowtype;
  v_to   public.turns%rowtype;
  v_policy public.swap_policy;
  v_is_org boolean;
  v_req_id uuid;
  v_group_name text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_from from public.turns where id = _from_turn;
  if not found then raise exception 'FROM_TURN_NOT_FOUND'; end if;
  select * into v_to from public.turns where id = _to_turn;
  if not found then raise exception 'TO_TURN_NOT_FOUND'; end if;

  if v_from.group_id <> v_to.group_id then raise exception 'CROSS_GROUP_SWAP_FORBIDDEN'; end if;
  if v_from.cycle_id <> v_to.cycle_id then raise exception 'CROSS_CYCLE_SWAP_FORBIDDEN'; end if;
  if v_from.status <> 'upcoming' or v_to.status <> 'upcoming' then
    raise exception 'TURN_NOT_UPCOMING';
  end if;
  if v_from.beneficiary_user_id <> v_user then raise exception 'NOT_FROM_BENEFICIARY'; end if;
  if v_to.beneficiary_user_id = v_user then raise exception 'SAME_BENEFICIARY'; end if;

  if not public.member_can(v_from.group_id, v_user, 'can_swap') then
    raise exception 'SWAP_PERMISSION_REVOKED';
  end if;

  select swap_policy into v_policy from public.groups where id = v_from.group_id;
  v_is_org := public.is_group_organizer(v_from.group_id, v_user);
  if v_policy = 'none' then raise exception 'SWAPS_DISABLED'; end if;
  if v_policy = 'organizer_only' and not v_is_org then raise exception 'ORGANIZER_ONLY_SWAPS'; end if;

  insert into public.turn_swap_requests
    (group_id, from_turn_id, to_turn_id, from_user_id, to_user_id, reason)
  values
    (v_from.group_id, _from_turn, _to_turn, v_user, v_to.beneficiary_user_id, _reason)
  returning id into v_req_id;

  select name into v_group_name from public.groups where id = v_from.group_id;
  if public.should_notify(v_to.beneficiary_user_id, 'swap_requested', 'in_app') then
    perform public.notify(
      v_to.beneficiary_user_id, 'swap_requested',
      'Demande d''échange de tour',
      'Un membre de ' || coalesce(v_group_name,'votre groupe') || ' propose d''échanger son tour avec le vôtre.',
      v_from.group_id, _from_turn, null,
      jsonb_build_object('request_id', v_req_id)
    );
  end if;

  perform public.log_audit(
    v_from.group_id, 'swap.request', 'turn_swap_request', v_req_id,
    jsonb_build_object('from_turn', _from_turn, 'to_turn', _to_turn,
                       'from_user', v_user, 'to_user', v_to.beneficiary_user_id)
  );
  return v_req_id;
end; $$;
grant execute on function public.request_turn_swap(uuid, uuid, text) to authenticated;