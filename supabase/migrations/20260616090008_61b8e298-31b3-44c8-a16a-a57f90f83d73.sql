-- ============ 27_turn_swaps ============
do $$ begin create type public.swap_policy as enum ('none','with_consent','organizer_only');
exception when duplicate_object then null; end $$;

alter table public.groups add column if not exists swap_policy public.swap_policy not null default 'with_consent';

do $$ begin create type public.swap_status as enum ('pending','accepted','rejected','cancelled');
exception when duplicate_object then null; end $$;

insert into public.notification_preferences (user_id, notif_type, channel, enabled)
select p.id, t.kind, c.channel, true from public.profiles p
cross join (values ('swap_requested'::public.notification_kind), ('swap_responded'::public.notification_kind), ('swap_executed'::public.notification_kind)) t(kind)
cross join (values ('in_app'::public.notification_channel), ('email'::public.notification_channel)) c(channel)
on conflict (user_id, notif_type, channel) do nothing;

create table if not exists public.turn_swap_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_turn_id uuid not null references public.turns(id) on delete cascade,
  to_turn_id uuid not null references public.turns(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  status public.swap_status not null default 'pending',
  reason text, created_at timestamptz not null default now(),
  responded_at timestamptz, responded_by uuid references auth.users(id) on delete set null,
  check (from_turn_id <> to_turn_id), check (from_user_id <> to_user_id)
);
create index if not exists turn_swap_group_status_idx on public.turn_swap_requests (group_id, status, created_at desc);
create index if not exists turn_swap_to_user_idx on public.turn_swap_requests (to_user_id, status);
create index if not exists turn_swap_from_user_idx on public.turn_swap_requests (from_user_id, status);
create unique index if not exists turn_swap_unique_pending on public.turn_swap_requests (from_turn_id, to_turn_id) where status = 'pending';
grant select, insert, update on public.turn_swap_requests to authenticated;
grant all on public.turn_swap_requests to service_role;
alter table public.turn_swap_requests enable row level security;
drop policy if exists "swap_select_group_members" on public.turn_swap_requests;
create policy "swap_select_group_members" on public.turn_swap_requests
  for select to authenticated
  using (public.is_group_member(group_id, auth.uid()) or public.is_group_organizer(group_id, auth.uid()));
drop policy if exists "swap_no_direct_write" on public.turn_swap_requests;
create policy "swap_no_direct_write" on public.turn_swap_requests
  for insert to authenticated with check (false);

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
  select swap_policy into v_policy from public.groups where id = v_from.group_id;
  v_is_org := public.is_group_organizer(v_from.group_id, v_user);
  if v_policy = 'none' then raise exception 'SWAPS_DISABLED'; end if;
  if v_policy = 'organizer_only' and not v_is_org then raise exception 'ORGANIZER_ONLY_SWAPS'; end if;
  insert into public.turn_swap_requests (group_id, from_turn_id, to_turn_id, from_user_id, to_user_id, reason)
  values (v_from.group_id, _from_turn, _to_turn, v_user, v_to.beneficiary_user_id, _reason) returning id into v_req_id;
  select name into v_group_name from public.groups where id = v_from.group_id;
  if public.should_notify(v_to.beneficiary_user_id, 'swap_requested', 'in_app') then
    perform public.notify(v_to.beneficiary_user_id, 'swap_requested', 'Demande d''échange de tour',
      'Un membre de ' || coalesce(v_group_name,'votre groupe') || ' propose d''échanger son tour avec le vôtre.',
      v_from.group_id, _from_turn, null, jsonb_build_object('request_id', v_req_id));
  end if;
  perform public.log_audit(v_from.group_id, 'swap.request', 'turn_swap_request', v_req_id,
    jsonb_build_object('from_turn', _from_turn, 'to_turn', _to_turn, 'from_user', v_user, 'to_user', v_to.beneficiary_user_id));
  return v_req_id;
end; $$;
grant execute on function public.request_turn_swap(uuid, uuid, text) to authenticated;

create or replace function public.respond_turn_swap(_request_id uuid, _accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_req public.turn_swap_requests%rowtype;
  v_from public.turns%rowtype; v_to public.turns%rowtype; v_is_org boolean; v_group_name text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_req from public.turn_swap_requests where id = _request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status <> 'pending' then raise exception 'REQUEST_NOT_PENDING'; end if;
  v_is_org := public.is_group_organizer(v_req.group_id, v_user);
  if v_user <> v_req.to_user_id and not v_is_org then raise exception 'FORBIDDEN'; end if;
  if not _accept then
    update public.turn_swap_requests set status='rejected', responded_at=now(), responded_by=v_user where id = _request_id;
    if public.should_notify(v_req.from_user_id, 'swap_responded', 'in_app') then
      perform public.notify(v_req.from_user_id, 'swap_responded', 'Échange refusé',
        'Votre demande d''échange de tour a été refusée.', v_req.group_id, v_req.from_turn_id, null,
        jsonb_build_object('request_id', _request_id, 'accepted', false));
    end if;
    perform public.log_audit(v_req.group_id, 'swap.reject', 'turn_swap_request', _request_id, null);
    return;
  end if;
  select * into v_from from public.turns where id = v_req.from_turn_id for update;
  select * into v_to from public.turns where id = v_req.to_turn_id for update;
  if v_from.status <> 'upcoming' or v_to.status <> 'upcoming' then raise exception 'TURN_NO_LONGER_UPCOMING'; end if;
  update public.turns set beneficiary_user_id = v_req.to_user_id where id = v_req.from_turn_id;
  update public.turns set beneficiary_user_id = v_req.from_user_id where id = v_req.to_turn_id;
  update public.turn_swap_requests set status='accepted', responded_at=now(), responded_by=v_user where id = _request_id;
  update public.turn_swap_requests set status='rejected', responded_at=now(), responded_by=v_user
    where status='pending' and id <> _request_id
      and (from_turn_id in (v_req.from_turn_id, v_req.to_turn_id) or to_turn_id in (v_req.from_turn_id, v_req.to_turn_id));
  select name into v_group_name from public.groups where id = v_req.group_id;
  if public.should_notify(v_req.from_user_id, 'swap_responded', 'in_app') then
    perform public.notify(v_req.from_user_id, 'swap_responded', 'Échange accepté',
      'Votre échange de tour dans ' || coalesce(v_group_name,'votre groupe') || ' a été accepté.',
      v_req.group_id, v_req.from_turn_id, null, jsonb_build_object('request_id', _request_id, 'accepted', true));
  end if;
  if public.should_notify(v_req.to_user_id, 'swap_executed', 'in_app') then
    perform public.notify(v_req.to_user_id, 'swap_executed', 'Échange effectué',
      'Votre tour a été échangé avec un autre membre.', v_req.group_id, v_req.to_turn_id, null,
      jsonb_build_object('request_id', _request_id));
  end if;
  perform public.log_audit(v_req.group_id, 'swap.accept', 'turn_swap_request', _request_id,
    jsonb_build_object('from_turn', v_req.from_turn_id, 'to_turn', v_req.to_turn_id));
end; $$;
grant execute on function public.respond_turn_swap(uuid, boolean) to authenticated;

create or replace function public.cancel_turn_swap(_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_req public.turn_swap_requests%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_req from public.turn_swap_requests where id = _request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status <> 'pending' then raise exception 'REQUEST_NOT_PENDING'; end if;
  if v_req.from_user_id <> v_user and not public.is_group_organizer(v_req.group_id, v_user) then raise exception 'FORBIDDEN'; end if;
  update public.turn_swap_requests set status='cancelled', responded_at=now(), responded_by=v_user where id = _request_id;
  perform public.log_audit(v_req.group_id, 'swap.cancel', 'turn_swap_request', _request_id, null);
end; $$;
grant execute on function public.cancel_turn_swap(uuid) to authenticated;

create or replace view public.turn_swap_requests_view as
select r.id, r.group_id, r.status, r.reason, r.created_at, r.responded_at,
  r.from_user_id, r.to_user_id, r.from_turn_id, r.to_turn_id,
  ft.turn_number as from_turn_number, ft.due_date as from_due_date,
  tt.turn_number as to_turn_number, tt.due_date as to_due_date,
  fp.full_name as from_user_name, tp.full_name as to_user_name
from public.turn_swap_requests r
join public.turns ft on ft.id = r.from_turn_id
join public.turns tt on tt.id = r.to_turn_id
left join public.profiles fp on fp.id = r.from_user_id
left join public.profiles tp on tp.id = r.to_user_id;
grant select on public.turn_swap_requests_view to authenticated;

create or replace function public.update_group_settings(_group_id uuid, _payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_status public.group_status;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_group_organizer(_group_id, v_user) then raise exception 'FORBIDDEN'; end if;
  select status into v_status from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if _payload ? 'name' and coalesce(_payload->>'name','') = '' then raise exception 'NAME_REQUIRED'; end if;
  if _payload ? 'contribution_amount' and coalesce((_payload->>'contribution_amount')::bigint, 0) <= 0 then raise exception 'INVALID_CONTRIBUTION'; end if;
  if _payload ? 'max_members' and coalesce((_payload->>'max_members')::int, 0) < 2 then raise exception 'INVALID_MAX_MEMBERS'; end if;
  if v_status not in ('draft', 'open') then
    if _payload ? 'swap_policy' then
      update public.groups set swap_policy = (_payload->>'swap_policy')::public.swap_policy, updated_at = now() where id = _group_id;
    end if;
    if exists (select 1 from jsonb_object_keys(_payload) as t(k) where t.k <> 'swap_policy') then
      raise exception 'CYCLE_ALREADY_STARTED';
    end if;
    return;
  end if;
  update public.groups set
    name = coalesce(nullif(_payload->>'name',''), name),
    description = case when _payload ? 'description' then nullif(_payload->>'description','') else description end,
    category = case when _payload ? 'category' then nullif(_payload->>'category','') else category end,
    contribution_amount = coalesce((_payload->>'contribution_amount')::bigint, contribution_amount),
    frequency = coalesce((_payload->>'frequency')::public.group_frequency, frequency),
    max_members = coalesce((_payload->>'max_members')::int, max_members),
    rotation_order_kind = coalesce((_payload->>'rotation_order_kind')::public.rotation_order, rotation_order_kind),
    late_penalty_percent = coalesce((_payload->>'late_penalty_percent')::int, late_penalty_percent),
    late_penalty_after_days = coalesce((_payload->>'late_penalty_after_days')::int, late_penalty_after_days),
    visibility = coalesce((_payload->>'visibility')::public.group_visibility, visibility),
    swap_policy = coalesce((_payload->>'swap_policy')::public.swap_policy, swap_policy),
    updated_at = now()
  where id = _group_id;
end; $$;
grant execute on function public.update_group_settings(uuid, jsonb) to authenticated;

-- ============ 28_turn_bids_auction ============
insert into public.notification_preferences (user_id, notif_type, channel, enabled)
select p.id, t.kind, c.channel, true from public.profiles p
cross join (values ('auction_outbid'::public.notification_kind), ('auction_won'::public.notification_kind),
  ('auction_lost'::public.notification_kind), ('auction_closed'::public.notification_kind)) t(kind)
cross join (values ('in_app'::public.notification_channel), ('email'::public.notification_channel)) c(channel)
on conflict (user_id, notif_type, channel) do nothing;

do $$ begin create type public.bid_status as enum ('active','won','lost','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.turn_bids (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  turn_id uuid not null references public.turns(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  bidder_user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount > 0),
  status public.bid_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists turn_bids_turn_amount_idx on public.turn_bids (turn_id, amount desc);
create index if not exists turn_bids_group_idx on public.turn_bids (group_id, status);
create unique index if not exists turn_bids_unique_active on public.turn_bids (turn_id, bidder_user_id) where status = 'active';
grant select on public.turn_bids to authenticated;
grant all on public.turn_bids to service_role;
alter table public.turn_bids enable row level security;
drop policy if exists "bids_select_group_members" on public.turn_bids;
create policy "bids_select_group_members" on public.turn_bids
  for select to authenticated
  using (public.is_group_member(group_id, auth.uid()) or public.is_group_organizer(group_id, auth.uid()));
drop policy if exists "bids_no_direct_write" on public.turn_bids;
create policy "bids_no_direct_write" on public.turn_bids
  for insert to authenticated with check (false);

do $$ begin
  perform 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'turn_bids';
  if not found then execute 'alter publication supabase_realtime add table public.turn_bids'; end if;
exception when others then null; end $$;

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
    where turn_id = _turn_id and bidder_user_id = v_user and status='active'
    returning id into v_bid_id;
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

create or replace function public.cancel_my_bid(_turn_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_group_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select group_id into v_group_id from public.turn_bids
    where turn_id = _turn_id and bidder_user_id = v_user and status='active' limit 1;
  if v_group_id is null then raise exception 'NO_ACTIVE_BID'; end if;
  update public.turn_bids set status='cancelled', updated_at=now()
    where turn_id = _turn_id and bidder_user_id = v_user and status='active';
  perform public.log_audit(v_group_id, 'auction.cancel_bid', 'turn', _turn_id, null);
end; $$;
grant execute on function public.cancel_my_bid(uuid) to authenticated;

create or replace function public.close_auction(_turn_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_turn public.turns%rowtype; v_winner uuid;
  v_winning_amount bigint; v_winning_bid_id uuid; v_winner_turn public.turns%rowtype;
  v_other_count int; v_share bigint; r record;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_turn from public.turns where id = _turn_id for update;
  if not found then raise exception 'TURN_NOT_FOUND'; end if;
  if not public.is_group_organizer(v_turn.group_id, v_user) then raise exception 'FORBIDDEN'; end if;
  if v_turn.status <> 'upcoming' then raise exception 'TURN_NOT_UPCOMING'; end if;
  select id, bidder_user_id, amount into v_winning_bid_id, v_winner, v_winning_amount
  from public.turn_bids where turn_id = _turn_id and status='active'
  order by amount desc, created_at asc limit 1;
  if v_winner is null then raise exception 'NO_BIDS'; end if;
  select * into v_winner_turn from public.turns
    where cycle_id = v_turn.cycle_id and beneficiary_user_id = v_winner
      and status = 'upcoming' and id <> _turn_id
    order by turn_number asc limit 1 for update;
  if not found then raise exception 'WINNER_HAS_NO_TURN'; end if;
  update public.turns set beneficiary_user_id = v_winner where id = _turn_id;
  update public.turns set beneficiary_user_id = v_turn.beneficiary_user_id where id = v_winner_turn.id;
  update public.turns set payout_amount = greatest(0, payout_amount - v_winning_amount) where id = _turn_id;
  select count(*) into v_other_count from public.turns
    where cycle_id = v_turn.cycle_id and status = 'upcoming' and id <> _turn_id;
  if v_other_count > 0 then
    v_share := v_winning_amount / v_other_count;
    if v_share > 0 then
      update public.turns set payout_amount = payout_amount + v_share
        where cycle_id = v_turn.cycle_id and status = 'upcoming' and id <> _turn_id;
    end if;
  end if;
  update public.turn_bids set status='won', updated_at=now() where id = v_winning_bid_id;
  update public.turn_bids set status='lost', updated_at=now()
    where turn_id = _turn_id and status='active' and id <> v_winning_bid_id;
  perform public.append_ledger(v_turn.group_id, v_turn.cycle_id, _turn_id, null, null, v_winner,
    'adjustment'::public.ledger_entry_type, 0,
    'Enchère remportée : prime de ' || v_winning_amount || ' GNF redistribuée sur ' || v_other_count || ' tour(s) restant(s)');
  if public.should_notify(v_winner, 'auction_won', 'in_app') then
    perform public.notify(v_winner, 'auction_won', 'Enchère remportée',
      'Vous prenez le tour #' || v_turn.turn_number || '. Prime versée : ' || v_winning_amount || ' GNF.',
      v_turn.group_id, _turn_id, null, jsonb_build_object('amount', v_winning_amount));
  end if;
  for r in select distinct bidder_user_id from public.turn_bids where turn_id = _turn_id and status='lost' loop
    if public.should_notify(r.bidder_user_id, 'auction_lost', 'in_app') then
      perform public.notify(r.bidder_user_id, 'auction_lost', 'Enchère perdue',
        'L''enchère du tour #' || v_turn.turn_number || ' a été remportée par un autre membre.',
        v_turn.group_id, _turn_id, null, null);
    end if;
  end loop;
  perform public.log_audit(v_turn.group_id, 'auction.close', 'turn', _turn_id,
    jsonb_build_object('winner_user_id', v_winner, 'winning_amount', v_winning_amount,
      'swapped_with_turn', v_winner_turn.id, 'redistributed_to_turns', v_other_count));
  return v_winning_bid_id;
end; $$;
grant execute on function public.close_auction(uuid) to authenticated;

create or replace view public.turn_bids_view as
select b.id, b.group_id, b.turn_id, b.cycle_id, b.bidder_user_id,
  b.amount, b.status, b.created_at, b.updated_at,
  p.full_name as bidder_name, t.turn_number, t.due_date
from public.turn_bids b
left join public.profiles p on p.id = b.bidder_user_id
join public.turns t on t.id = b.turn_id;
grant select on public.turn_bids_view to authenticated;

-- ============ 29_member_reviews ============
insert into public.notification_preferences (user_id, notif_type, channel, enabled)
select p.id, 'review_received'::public.notification_kind, c.channel, true from public.profiles p
cross join (values ('in_app'::public.notification_channel), ('email'::public.notification_channel)) c(channel)
on conflict (user_id, notif_type, channel) do nothing;

create table if not exists public.member_reviews (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id) on delete cascade,
  reviewed_user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text, created_at timestamptz not null default now(),
  unique (cycle_id, reviewer_user_id, reviewed_user_id),
  check (reviewer_user_id <> reviewed_user_id)
);
create index if not exists member_reviews_reviewed_idx on public.member_reviews (reviewed_user_id);
create index if not exists member_reviews_group_idx on public.member_reviews (group_id);
grant select on public.member_reviews to authenticated;
grant all on public.member_reviews to service_role;
alter table public.member_reviews enable row level security;
drop policy if exists "reviews_select_group_members" on public.member_reviews;
create policy "reviews_select_group_members" on public.member_reviews
  for select to authenticated
  using (public.is_group_member(group_id, auth.uid()) or public.is_group_organizer(group_id, auth.uid())
    or reviewed_user_id = auth.uid() or reviewer_user_id = auth.uid());
drop policy if exists "reviews_no_direct_write" on public.member_reviews;
create policy "reviews_no_direct_write" on public.member_reviews
  for insert to authenticated with check (false);

create or replace function public.submit_review(_group_id uuid, _reviewed_user_id uuid, _rating int, _comment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_group public.groups%rowtype; v_cycle_id uuid; v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if _rating < 1 or _rating > 5 then raise exception 'INVALID_RATING'; end if;
  if v_user = _reviewed_user_id then raise exception 'SELF_REVIEW_FORBIDDEN'; end if;
  select * into v_group from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if v_group.status::text <> 'completed' then raise exception 'CYCLE_NOT_COMPLETED'; end if;
  select id into v_cycle_id from public.cycles where group_id = _group_id order by cycle_number desc limit 1;
  if v_cycle_id is null then raise exception 'NO_CYCLE'; end if;
  if not exists (
    select 1 from public.turns t where t.cycle_id = v_cycle_id and t.beneficiary_user_id in (v_user, _reviewed_user_id)
    union
    select 1 from public.contributions c join public.turns t2 on t2.id = c.turn_id
      where t2.cycle_id = v_cycle_id and c.payer_user_id in (v_user, _reviewed_user_id)
  ) then raise exception 'NOT_A_PARTICIPANT'; end if;
  insert into public.member_reviews (group_id, cycle_id, reviewer_user_id, reviewed_user_id, rating, comment)
  values (_group_id, v_cycle_id, v_user, _reviewed_user_id, _rating, nullif(trim(coalesce(_comment,'')), ''))
  returning id into v_id;
  if public.should_notify(_reviewed_user_id, 'review_received', 'in_app') then
    perform public.notify(_reviewed_user_id, 'review_received', 'Nouvel avis reçu',
      'Un membre vous a attribué ' || _rating || '/5 dans ' || coalesce(v_group.name,'votre groupe') || '.',
      _group_id, null, null, jsonb_build_object('rating', _rating));
  end if;
  perform public.log_audit(_group_id, 'review.submit', 'member_review', v_id,
    jsonb_build_object('reviewed_user_id', _reviewed_user_id, 'rating', _rating));
  return v_id;
end; $$;
grant execute on function public.submit_review(uuid, uuid, int, text) to authenticated;

create or replace view public.member_review_summary with (security_invoker = true) as
select reviewed_user_id as user_id, group_id,
  round(avg(rating)::numeric, 2) as avg_rating, count(*)::int as reviews_count
from public.member_reviews group by reviewed_user_id, group_id;
grant select on public.member_review_summary to authenticated;

create or replace view public.member_review_global with (security_invoker = true) as
select reviewed_user_id as user_id,
  round(avg(rating)::numeric, 2) as avg_rating, count(*)::int as reviews_count
from public.member_reviews group by reviewed_user_id;
grant select on public.member_review_global to authenticated;

create or replace view public.my_reviews_given with (security_invoker = true) as
select id, group_id, cycle_id, reviewed_user_id, rating, comment, created_at
from public.member_reviews where reviewer_user_id = auth.uid();
grant select on public.my_reviews_given to authenticated;

notify pgrst, 'reload schema';