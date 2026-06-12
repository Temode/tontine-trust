-- =====================================================================
-- Tontine Digital — P2.4 : enchères de tours (prime à la hausse)
-- À exécuter APRÈS db/28a_auction_enum_prelude.sql
-- Idempotent.
-- =====================================================================

-- 1. rotation_order 'auction' et notification_kind (auction_*) :
--    ajoutés via db/28a_auction_enum_prelude.sql (transaction séparée requise)

-- 3. Préférences par défaut
insert into public.notification_preferences (user_id, notif_type, channel, enabled)
select p.id, t.kind, c.channel, true
from public.profiles p
cross join (values ('auction_outbid'::public.notification_kind),
                   ('auction_won'::public.notification_kind),
                   ('auction_lost'::public.notification_kind),
                   ('auction_closed'::public.notification_kind)) t(kind)
cross join (values ('in_app'::public.notification_channel),
                   ('email'::public.notification_channel)) c(channel)
on conflict (user_id, notif_type, channel) do nothing;

-- 4. Statut d'enchère
do $$ begin
  create type public.bid_status as enum ('active','won','lost','cancelled');
exception when duplicate_object then null; end $$;

-- 5. Table principale
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

create index if not exists turn_bids_turn_amount_idx
  on public.turn_bids (turn_id, amount desc);
create index if not exists turn_bids_group_idx
  on public.turn_bids (group_id, status);
create unique index if not exists turn_bids_unique_active
  on public.turn_bids (turn_id, bidder_user_id) where status = 'active';

grant select on public.turn_bids to authenticated;
grant all on public.turn_bids to service_role;

alter table public.turn_bids enable row level security;

drop policy if exists "bids_select_group_members" on public.turn_bids;
create policy "bids_select_group_members" on public.turn_bids
  for select to authenticated
  using (
    public.is_group_member(group_id, auth.uid())
    or public.is_group_organizer(group_id, auth.uid())
  );

drop policy if exists "bids_no_direct_write" on public.turn_bids;
create policy "bids_no_direct_write" on public.turn_bids
  for insert to authenticated with check (false);

-- 6. Realtime
do $$ begin
  perform 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'turn_bids';
  if not found then
    execute 'alter publication supabase_realtime add table public.turn_bids';
  end if;
exception when others then null;
end $$;

-- 7. RPC : place_bid
create or replace function public.place_bid(
  _turn_id uuid,
  _amount bigint
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

  if v_turn.beneficiary_user_id = v_user then
    raise exception 'ALREADY_BENEFICIARY';
  end if;

  -- L'enchérisseur doit être bénéficiaire d'un autre tour upcoming POSTÉRIEUR (échange = avancer)
  select * into v_my_turn from public.turns
    where cycle_id = v_turn.cycle_id
      and beneficiary_user_id = v_user
      and status = 'upcoming'
      and turn_number > v_turn.turn_number
    order by turn_number asc
    limit 1;
  if not found then raise exception 'NO_LATER_TURN_TO_TRADE'; end if;

  if _amount < 1 then raise exception 'INVALID_AMOUNT'; end if;

  select coalesce(max(amount), 0) into v_current_max
    from public.turn_bids where turn_id = _turn_id and status = 'active';
  if _amount <= v_current_max then
    raise exception 'BID_TOO_LOW';
  end if;

  -- Upsert : un seul bid actif par membre par tour
  if exists (select 1 from public.turn_bids
             where turn_id = _turn_id and bidder_user_id = v_user and status='active') then
    update public.turn_bids
      set amount = _amount, updated_at = now()
    where turn_id = _turn_id and bidder_user_id = v_user and status='active'
    returning id into v_bid_id;
  else
    insert into public.turn_bids (group_id, turn_id, cycle_id, bidder_user_id, amount)
    values (v_turn.group_id, _turn_id, v_turn.cycle_id, v_user, _amount)
    returning id into v_bid_id;
  end if;

  -- Notif aux autres enchérisseurs actifs
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

-- 8. RPC : cancel_my_bid
create or replace function public.cancel_my_bid(_turn_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select group_id into v_group_id from public.turn_bids
    where turn_id = _turn_id and bidder_user_id = v_user and status='active'
    limit 1;
  if v_group_id is null then raise exception 'NO_ACTIVE_BID'; end if;

  update public.turn_bids
    set status='cancelled', updated_at=now()
  where turn_id = _turn_id and bidder_user_id = v_user and status='active';

  perform public.log_audit(v_group_id, 'auction.cancel_bid', 'turn', _turn_id, null);
end; $$;

grant execute on function public.cancel_my_bid(uuid) to authenticated;

-- 9. RPC : close_auction (organisateur)
create or replace function public.close_auction(_turn_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_turn public.turns%rowtype;
  v_winner uuid;
  v_winning_amount bigint;
  v_winning_bid_id uuid;
  v_winner_turn public.turns%rowtype;
  v_other_count int;
  v_share bigint;
  r record;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_turn from public.turns where id = _turn_id for update;
  if not found then raise exception 'TURN_NOT_FOUND'; end if;
  if not public.is_group_organizer(v_turn.group_id, v_user) then
    raise exception 'FORBIDDEN';
  end if;
  if v_turn.status <> 'upcoming' then raise exception 'TURN_NOT_UPCOMING'; end if;

  -- Sélection du bid gagnant (max amount, ancienneté en cas d'égalité)
  select id, bidder_user_id, amount
    into v_winning_bid_id, v_winner, v_winning_amount
  from public.turn_bids
  where turn_id = _turn_id and status='active'
  order by amount desc, created_at asc
  limit 1;
  if v_winner is null then raise exception 'NO_BIDS'; end if;

  -- Tour actuel du gagnant (qu'on va échanger avec _turn_id)
  select * into v_winner_turn from public.turns
    where cycle_id = v_turn.cycle_id
      and beneficiary_user_id = v_winner
      and status = 'upcoming'
      and id <> _turn_id
    order by turn_number asc
    limit 1
  for update;
  if not found then raise exception 'WINNER_HAS_NO_TURN'; end if;

  -- Swap atomique des bénéficiaires (le gagnant prend le tour auctionné)
  update public.turns set beneficiary_user_id = v_winner
    where id = _turn_id;
  update public.turns set beneficiary_user_id = v_turn.beneficiary_user_id
    where id = v_winner_turn.id;

  -- Redistribution : winner paie une prime (= v_winning_amount) prélevée sur son payout,
  -- redistribuée à parts égales sur les autres tours upcoming.
  update public.turns
    set payout_amount = greatest(0, payout_amount - v_winning_amount)
  where id = _turn_id;

  select count(*) into v_other_count from public.turns
    where cycle_id = v_turn.cycle_id
      and status = 'upcoming'
      and id <> _turn_id;

  if v_other_count > 0 then
    v_share := v_winning_amount / v_other_count;
    if v_share > 0 then
      update public.turns
        set payout_amount = payout_amount + v_share
      where cycle_id = v_turn.cycle_id
        and status = 'upcoming'
        and id <> _turn_id;
    end if;
  end if;

  -- Marque bids
  update public.turn_bids set status='won', updated_at=now()
    where id = v_winning_bid_id;
  update public.turn_bids set status='lost', updated_at=now()
    where turn_id = _turn_id and status='active' and id <> v_winning_bid_id;

  -- Ledger : trace adjustement de la prime
  perform public.append_ledger(
    v_turn.group_id, v_turn.cycle_id, _turn_id, null, null, v_winner,
    'adjustment'::public.ledger_entry_type, 0,
    'Enchère remportée : prime de ' || v_winning_amount
      || ' GNF redistribuée sur ' || v_other_count || ' tour(s) restant(s)'
  );

  -- Notifs
  if public.should_notify(v_winner, 'auction_won', 'in_app') then
    perform public.notify(
      v_winner, 'auction_won',
      'Enchère remportée',
      'Vous prenez le tour #' || v_turn.turn_number || '. Prime versée : ' || v_winning_amount || ' GNF.',
      v_turn.group_id, _turn_id, null,
      jsonb_build_object('amount', v_winning_amount)
    );
  end if;
  for r in
    select distinct bidder_user_id from public.turn_bids
    where turn_id = _turn_id and status='lost'
  loop
    if public.should_notify(r.bidder_user_id, 'auction_lost', 'in_app') then
      perform public.notify(
        r.bidder_user_id, 'auction_lost',
        'Enchère perdue',
        'L''enchère du tour #' || v_turn.turn_number || ' a été remportée par un autre membre.',
        v_turn.group_id, _turn_id, null, null
      );
    end if;
  end loop;

  perform public.log_audit(
    v_turn.group_id, 'auction.close', 'turn', _turn_id,
    jsonb_build_object(
      'winner_user_id', v_winner,
      'winning_amount', v_winning_amount,
      'swapped_with_turn', v_winner_turn.id,
      'redistributed_to_turns', v_other_count
    )
  );

  return v_winning_bid_id;
end; $$;

grant execute on function public.close_auction(uuid) to authenticated;

-- 10. Vue enrichie pour l'UI
create or replace view public.turn_bids_view as
select
  b.id, b.group_id, b.turn_id, b.cycle_id, b.bidder_user_id,
  b.amount, b.status, b.created_at, b.updated_at,
  p.full_name as bidder_name,
  t.turn_number, t.due_date
from public.turn_bids b
left join public.profiles p on p.id = b.bidder_user_id
join public.turns t on t.id = b.turn_id;

grant select on public.turn_bids_view to authenticated;