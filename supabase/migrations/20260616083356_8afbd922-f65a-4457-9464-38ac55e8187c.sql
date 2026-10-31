-- ===== 03_phase_b_rotation.sql =====
do $$ begin alter type public.member_status add value if not exists 'pending'; exception when duplicate_object then null; end $$;

create or replace function public.join_group_with_code(_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_invitation public.invitations%rowtype;
  v_user uuid := auth.uid();
  v_active int; v_pending int; v_max int;
  v_existing public.group_members%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_invitation from public.invitations where code = _code;
  if not found then raise exception 'INVITATION_NOT_FOUND'; end if;
  if v_invitation.status <> 'pending' then raise exception 'INVITATION_INACTIVE'; end if;
  if v_invitation.expires_at is not null and v_invitation.expires_at < now() then
    update public.invitations set status = 'expired' where id = v_invitation.id;
    raise exception 'INVITATION_EXPIRED';
  end if;
  if v_invitation.max_uses is not null and v_invitation.uses_count >= v_invitation.max_uses then
    raise exception 'INVITATION_EXHAUSTED';
  end if;
  select * into v_existing from public.group_members where group_id = v_invitation.group_id and user_id = v_user;
  if found then
    if v_existing.status::text in ('active','pending') then return v_invitation.group_id; end if;
    update public.group_members set status = 'pending'::public.member_status, position = null where id = v_existing.id;
  else
    select max_members into v_max from public.groups where id = v_invitation.group_id;
    select count(*) into v_active from public.group_members where group_id = v_invitation.group_id and status = 'active';
    select count(*) into v_pending from public.group_members where group_id = v_invitation.group_id and status::text = 'pending';
    if v_active + v_pending >= v_max then raise exception 'GROUP_FULL'; end if;
    insert into public.group_members (group_id, user_id, role, status, position)
    values (v_invitation.group_id, v_user, 'membre', 'pending'::public.member_status, null);
  end if;
  update public.invitations set uses_count = uses_count + 1 where id = v_invitation.id;
  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_invitation.created_by, 'invitation_accepted', 'Nouvelle candidature',
    'Un utilisateur souhaite rejoindre votre groupe. Validez ou refusez la demande.', v_invitation.group_id);
  return v_invitation.group_id;
end; $$;
grant execute on function public.join_group_with_code(text) to authenticated;

create or replace function public.approve_member(_member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_member public.group_members%rowtype; v_active int; v_max int; v_next_pos int;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_member from public.group_members where id = _member_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if not public.is_group_organizer(v_member.group_id, v_user) then raise exception 'FORBIDDEN'; end if;
  if v_member.status::text <> 'pending' then raise exception 'NOT_PENDING'; end if;
  select max_members into v_max from public.groups where id = v_member.group_id;
  select count(*) into v_active from public.group_members where group_id = v_member.group_id and status = 'active';
  if v_active >= v_max then raise exception 'GROUP_FULL'; end if;
  select coalesce(max(position), 0) + 1 into v_next_pos from public.group_members where group_id = v_member.group_id and status = 'active';
  update public.group_members set status = 'active', position = v_next_pos where id = _member_id;
  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_member.user_id, 'invitation_accepted', 'Candidature acceptée',
    'Votre demande d''adhésion au groupe a été acceptée.', v_member.group_id);
end; $$;
grant execute on function public.approve_member(uuid) to authenticated;

create or replace function public.reject_member(_member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_member public.group_members%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_member from public.group_members where id = _member_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if not public.is_group_organizer(v_member.group_id, v_user) then raise exception 'FORBIDDEN'; end if;
  if v_member.status::text <> 'pending' then raise exception 'NOT_PENDING'; end if;
  update public.group_members set status = 'removed' where id = _member_id;
  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_member.user_id, 'system', 'Candidature refusée',
    'Votre demande d''adhésion au groupe a été refusée.', v_member.group_id);
end; $$;
grant execute on function public.reject_member(uuid) to authenticated;

create or replace function public.start_cycle(_group_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid(); v_group public.groups%rowtype;
  v_count int; v_cycle_id uuid; v_cycle_number int;
  v_freq_days int; v_payout bigint; v_due date; r record;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_group from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if not public.is_group_organizer(_group_id, v_user) then raise exception 'FORBIDDEN'; end if;
  if v_group.status not in ('draft','open') then raise exception 'CYCLE_ALREADY_STARTED'; end if;
  select count(*) into v_count from public.group_members where group_id = _group_id and status = 'active';
  if v_count < 2 then raise exception 'QUORUM_NOT_REACHED'; end if;
  if v_group.rotation_order_kind = 'random' then
    with shuffled as (select id, row_number() over (order by random()) as rn from public.group_members where group_id = _group_id and status = 'active')
    update public.group_members gm set position = s.rn from shuffled s where gm.id = s.id;
  else
    with ordered as (select id, row_number() over (order by position nulls last, joined_at) as rn from public.group_members where group_id = _group_id and status = 'active')
    update public.group_members gm set position = o.rn from ordered o where gm.id = o.id;
  end if;
  select coalesce(max(cycle_number), 0) + 1 into v_cycle_number from public.cycles where group_id = _group_id;
  insert into public.cycles (group_id, cycle_number, started_at) values (_group_id, v_cycle_number, now()) returning id into v_cycle_id;
  v_freq_days := case v_group.frequency when 'hebdomadaire' then 7 when 'quinzaine' then 14 when 'mensuelle' then 30 end;
  v_payout := v_group.contribution_amount * v_count;
  v_due := current_date + v_freq_days;
  for r in select user_id, position from public.group_members where group_id = _group_id and status = 'active' order by position loop
    insert into public.turns (cycle_id, group_id, beneficiary_user_id, turn_number, due_date, payout_amount, status)
    values (v_cycle_id, _group_id, r.user_id, r.position, v_due, v_payout,
            case when r.position = 1 then 'collecting'::public.turn_status else 'upcoming'::public.turn_status end);
    insert into public.contributions (turn_id, group_id, payer_user_id, amount, status)
    select (select id from public.turns where cycle_id = v_cycle_id and turn_number = r.position),
           _group_id, gm.user_id, v_group.contribution_amount, 'pending'
    from public.group_members gm where gm.group_id = _group_id and gm.status = 'active' and gm.user_id <> r.user_id;
    v_due := v_due + v_freq_days;
  end loop;
  update public.groups set status = 'active' where id = _group_id;
  insert into public.notifications (user_id, kind, title, body, group_id)
  select gm.user_id, 'cycle_started', 'Cycle démarré', 'L''ordre de rotation a été tiré. Premier tour planifié.', _group_id
  from public.group_members gm where gm.group_id = _group_id and gm.status = 'active';
  return v_cycle_id;
end; $$;
grant execute on function public.start_cycle(uuid) to authenticated;

create or replace view public.next_turn_per_group with (security_invoker = true) as
select distinct on (t.group_id)
  t.group_id, t.id as turn_id, t.cycle_id, t.turn_number, t.due_date,
  t.payout_amount, t.status, t.beneficiary_user_id, p.full_name as beneficiary_name
from public.turns t
left join public.profiles p on p.id = t.beneficiary_user_id
where t.status in ('upcoming','collecting')
order by t.group_id, t.due_date asc, t.turn_number asc;
grant select on public.next_turn_per_group to authenticated;

-- ===== 04_phase_c_ledger.sql =====
do $$ begin create type public.payment_status as enum ('initiated', 'pending', 'succeeded', 'failed', 'cancelled', 'refunded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ledger_entry_type as enum ('contribution_in', 'payout_out', 'fee', 'refund', 'penalty', 'adjustment'); exception when duplicate_object then null; end $$;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.contributions(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  amount bigint not null check (amount > 0),
  provider public.payment_provider not null,
  provider_ref text,
  status public.payment_status not null default 'initiated',
  error_message text,
  initiated_at timestamptz not null default now(),
  settled_at timestamptz
);
create index if not exists payments_contribution_idx on public.payments(contribution_id);
create index if not exists payments_user_idx on public.payments(user_id);
create index if not exists payments_group_idx on public.payments(group_id);
create unique index if not exists payments_provider_ref_uq on public.payments(provider, provider_ref) where provider_ref is not null;

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  seq bigserial not null,
  group_id uuid not null references public.groups(id) on delete restrict,
  cycle_id uuid references public.cycles(id) on delete restrict,
  turn_id uuid references public.turns(id) on delete restrict,
  contribution_id uuid references public.contributions(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete restrict,
  user_id uuid references auth.users(id) on delete restrict,
  entry_type public.ledger_entry_type not null,
  amount bigint not null,
  balance_after bigint,
  memo text,
  prev_hash text,
  hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists ledger_group_seq_idx on public.ledger_entries(group_id, seq);
create index if not exists ledger_payment_idx on public.ledger_entries(payment_id);
create index if not exists ledger_turn_idx on public.ledger_entries(turn_id);

grant select on public.payments to authenticated;
grant all on public.payments to service_role;
grant select on public.ledger_entries to authenticated;
grant all on public.ledger_entries to service_role;

alter table public.payments enable row level security;
alter table public.ledger_entries enable row level security;

drop policy if exists payments_select_member on public.payments;
create policy payments_select_member on public.payments for select to authenticated using (public.is_group_member(group_id, auth.uid()));
drop policy if exists ledger_select_member on public.ledger_entries;
create policy ledger_select_member on public.ledger_entries for select to authenticated using (public.is_group_member(group_id, auth.uid()));

create extension if not exists pgcrypto;

create or replace function public.append_ledger(
  _group_id uuid, _cycle_id uuid, _turn_id uuid, _contribution_id uuid, _payment_id uuid,
  _user_id uuid, _entry_type public.ledger_entry_type, _amount bigint, _memo text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_prev_hash text; v_prev_balance bigint; v_new_balance bigint; v_hash text; v_id uuid;
begin
  select hash, balance_after into v_prev_hash, v_prev_balance from public.ledger_entries where group_id = _group_id order by seq desc limit 1;
  v_new_balance := coalesce(v_prev_balance, 0) + _amount;
  v_hash := encode(digest(coalesce(v_prev_hash, '') || '|' || _group_id::text || '|' || _entry_type::text || '|' || _amount::text || '|' ||
    coalesce(_payment_id::text, '') || '|' || coalesce(_turn_id::text, '') || '|' || extract(epoch from now())::text, 'sha256'), 'hex');
  insert into public.ledger_entries (group_id, cycle_id, turn_id, contribution_id, payment_id, user_id, entry_type, amount, balance_after, memo, prev_hash, hash)
  values (_group_id, _cycle_id, _turn_id, _contribution_id, _payment_id, _user_id, _entry_type, _amount, v_new_balance, _memo, v_prev_hash, v_hash)
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.record_mock_payment(_contribution_id uuid, _provider public.payment_provider default 'simulation')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_contrib public.contributions%rowtype; v_turn public.turns%rowtype; v_payment_id uuid; v_remaining int;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_contrib from public.contributions where id = _contribution_id;
  if not found then raise exception 'CONTRIBUTION_NOT_FOUND'; end if;
  if v_contrib.payer_user_id <> v_user then raise exception 'FORBIDDEN'; end if;
  if v_contrib.status = 'confirmed' then raise exception 'ALREADY_PAID'; end if;
  select * into v_turn from public.turns where id = v_contrib.turn_id;
  insert into public.payments (contribution_id, group_id, user_id, amount, provider, provider_ref, status, initiated_at, settled_at)
  values (v_contrib.id, v_contrib.group_id, v_user, v_contrib.amount, _provider,
    'MOCK-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), 'succeeded', now(), now())
  returning id into v_payment_id;
  update public.contributions set status = 'confirmed', provider = _provider,
    reference = (select provider_ref from public.payments where id = v_payment_id),
    submitted_at = now(), confirmed_at = now(), confirmed_by = v_user
  where id = v_contrib.id;
  perform public.append_ledger(v_contrib.group_id, v_turn.cycle_id, v_turn.id, v_contrib.id, v_payment_id, v_user,
    'contribution_in', v_contrib.amount, 'Cotisation tour #' || v_turn.turn_number);
  select count(*) into v_remaining from public.contributions where turn_id = v_turn.id and status <> 'confirmed';
  if v_remaining = 0 and v_turn.status <> 'paid' then
    update public.turns set status = 'collecting' where id = v_turn.id and status <> 'paid';
    insert into public.notifications (user_id, kind, title, body, group_id)
    values (v_turn.beneficiary_user_id, 'contribution_received', 'Cagnotte complète',
      'Toutes les cotisations de votre tour ont été reçues. Versement à venir.', v_turn.group_id);
  end if;
  return v_payment_id;
end; $$;
grant execute on function public.record_mock_payment(uuid, public.payment_provider) to authenticated;

create or replace view public.my_contributions_due with (security_invoker = true) as
select c.id as contribution_id, c.turn_id, c.group_id, g.name as group_name, c.amount, c.status,
       t.turn_number, t.due_date, t.beneficiary_user_id, pb.full_name as beneficiary_name,
       (t.due_date - current_date) as days_to_due
from public.contributions c
join public.turns t on t.id = c.turn_id
join public.groups g on g.id = c.group_id
left join public.profiles pb on pb.id = t.beneficiary_user_id
where c.payer_user_id = auth.uid()
  and c.status in ('pending', 'submitted', 'rejected')
  and t.status in ('upcoming', 'collecting')
order by t.due_date asc;
grant select on public.my_contributions_due to authenticated;

create or replace view public.my_payments_history with (security_invoker = true) as
select p.id as payment_id, p.contribution_id, p.group_id, g.name as group_name, p.amount, p.provider,
       p.provider_ref, p.status, p.initiated_at, p.settled_at, t.turn_number
from public.payments p
join public.groups g on g.id = p.group_id
join public.contributions c on c.id = p.contribution_id
join public.turns t on t.id = c.turn_id
where p.user_id = auth.uid()
order by p.initiated_at desc;
grant select on public.my_payments_history to authenticated;

-- ===== 05_phase_d_payout.sql =====
do $$ begin alter type public.notification_kind add value if not exists 'payout_released'; exception when duplicate_object then null; end $$;

create sequence if not exists public.receipts_number_seq;

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  turn_id uuid not null unique references public.turns(id) on delete restrict,
  group_id uuid not null references public.groups(id) on delete restrict,
  cycle_id uuid not null references public.cycles(id) on delete restrict,
  beneficiary_user_id uuid not null references auth.users(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  amount bigint not null check (amount > 0),
  provider public.payment_provider not null,
  ledger_entry_id uuid references public.ledger_entries(id) on delete restrict,
  hash text not null,
  issued_by uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default now()
);
create index if not exists receipts_group_idx on public.receipts(group_id);
create index if not exists receipts_beneficiary_idx on public.receipts(beneficiary_user_id);

grant select on public.receipts to authenticated;
grant all on public.receipts to service_role;
alter table public.receipts enable row level security;
drop policy if exists receipts_select_member on public.receipts;
create policy receipts_select_member on public.receipts for select to authenticated using (public.is_group_member(group_id, auth.uid()));

create or replace function public.release_payout(_turn_id uuid, _provider public.payment_provider default 'simulation')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_turn public.turns%rowtype; v_remaining int; v_total_collected bigint;
        v_payment_id uuid; v_receipt_id uuid; v_receipt_number text; v_ledger_id uuid; v_hash text; v_remaining_turns int;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_turn from public.turns where id = _turn_id for update;
  if not found then raise exception 'TURN_NOT_FOUND'; end if;
  if not public.is_group_organizer(v_turn.group_id, v_user) then raise exception 'FORBIDDEN'; end if;
  if v_turn.status = 'paid' then raise exception 'ALREADY_PAID'; end if;
  if v_turn.status <> 'collecting' then raise exception 'TURN_NOT_READY'; end if;
  select count(*) into v_remaining from public.contributions where turn_id = v_turn.id and status <> 'confirmed';
  if v_remaining > 0 then raise exception 'CONTRIBUTIONS_INCOMPLETE'; end if;
  select coalesce(sum(amount), 0) into v_total_collected from public.contributions where turn_id = v_turn.id and status = 'confirmed';
  if v_total_collected <> v_turn.payout_amount then raise exception 'AMOUNT_MISMATCH'; end if;
  insert into public.payments (contribution_id, group_id, user_id, amount, provider, provider_ref, status, initiated_at, settled_at)
  select c.id, v_turn.group_id, v_turn.beneficiary_user_id, v_total_collected, _provider,
         'PAYOUT-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), 'succeeded', now(), now()
  from public.contributions c where c.turn_id = v_turn.id order by c.confirmed_at desc nulls last limit 1
  returning id into v_payment_id;
  v_ledger_id := public.append_ledger(v_turn.group_id, v_turn.cycle_id, v_turn.id, null, v_payment_id,
    v_turn.beneficiary_user_id, 'payout_out', -v_total_collected, 'Versement tour #' || v_turn.turn_number);
  v_receipt_number := 'TD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receipts_number_seq')::text, 6, '0');
  v_hash := encode(digest(v_receipt_number || '|' || v_turn.id::text || '|' || v_payment_id::text || '|' ||
    v_total_collected::text || '|' || extract(epoch from now())::text, 'sha256'), 'hex');
  insert into public.receipts (receipt_number, turn_id, group_id, cycle_id, beneficiary_user_id, payment_id, amount, provider, ledger_entry_id, hash, issued_by)
  values (v_receipt_number, v_turn.id, v_turn.group_id, v_turn.cycle_id, v_turn.beneficiary_user_id,
    v_payment_id, v_total_collected, _provider, v_ledger_id, v_hash, v_user)
  returning id into v_receipt_id;
  update public.turns set status = 'paid', paid_at = now() where id = v_turn.id;
  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_turn.beneficiary_user_id, 'payout_released', 'Versement effectué',
    'Vous avez reçu votre cagnotte. Le reçu numérique est disponible.', v_turn.group_id);
  select count(*) into v_remaining_turns from public.turns where cycle_id = v_turn.cycle_id and status <> 'paid';
  if v_remaining_turns = 0 then
    update public.cycles set ended_at = now() where id = v_turn.cycle_id and ended_at is null;
  end if;
  return v_receipt_id;
end; $$;
grant execute on function public.release_payout(uuid, public.payment_provider) to authenticated;

create or replace view public.group_ledger_view with (security_invoker = true) as
select l.id, l.seq, l.group_id, l.turn_id, l.payment_id, l.user_id, l.entry_type,
       l.amount, l.balance_after, l.memo, l.created_at, p.full_name as user_name, t.turn_number
from public.ledger_entries l
left join public.profiles p on p.id = l.user_id
left join public.turns t on t.id = l.turn_id
order by l.group_id, l.seq desc;
grant select on public.group_ledger_view to authenticated;

create or replace view public.my_receipts with (security_invoker = true) as
select r.id, r.receipt_number, r.turn_id, r.group_id, g.name as group_name, r.amount, r.provider, r.hash,
       r.issued_at, t.turn_number, r.beneficiary_user_id, pb.full_name as beneficiary_name, pi.full_name as issued_by_name
from public.receipts r
join public.groups g on g.id = r.group_id
join public.turns t on t.id = r.turn_id
left join public.profiles pb on pb.id = r.beneficiary_user_id
left join public.profiles pi on pi.id = r.issued_by
where r.beneficiary_user_id = auth.uid()
order by r.issued_at desc;
grant select on public.my_receipts to authenticated;

create or replace view public.turn_settlement with (security_invoker = true) as
select t.id as turn_id, t.group_id, t.cycle_id, t.turn_number, t.status, t.beneficiary_user_id,
       t.payout_amount, t.due_date, t.paid_at,
       (select count(*) from public.contributions c where c.turn_id = t.id) as expected_count,
       (select count(*) from public.contributions c where c.turn_id = t.id and c.status = 'confirmed') as confirmed_count,
       (select coalesce(sum(c.amount),0) from public.contributions c where c.turn_id = t.id and c.status = 'confirmed') as collected_amount,
       (select id from public.receipts r where r.turn_id = t.id) as receipt_id
from public.turns t;
grant select on public.turn_settlement to authenticated;

-- ===== 06_phase_e_reliability.sql =====
do $$ begin create type public.reliability_tier as enum ('nouveau', 'risque', 'moyen', 'bon', 'excellent'); exception when duplicate_object then null; end $$;

create table if not exists public.user_reliability_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  score int not null default 0 check (score between 0 and 100),
  tier public.reliability_tier not null default 'nouveau',
  total_due int not null default 0,
  total_paid int not null default 0,
  total_on_time int not null default 0,
  total_late int not null default 0,
  avg_delay_days numeric(6,2) not null default 0,
  cycles_completed int not null default 0,
  last_computed_at timestamptz not null default now()
);

grant select on public.user_reliability_scores to authenticated;
grant all on public.user_reliability_scores to service_role;
alter table public.user_reliability_scores enable row level security;

create or replace function public.shares_group_with(_other uuid, _me uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = _me and b.user_id = _other and a.status = 'active' and b.status = 'active'
  );
$$;

drop policy if exists reliability_select_self_or_peer on public.user_reliability_scores;
create policy reliability_select_self_or_peer on public.user_reliability_scores for select to authenticated
  using (user_id = auth.uid() or public.shares_group_with(user_id, auth.uid()));

create or replace function public.recompute_reliability(_user_id uuid default auth.uid())
returns public.user_reliability_scores language plpgsql security definer set search_path = public as $$
declare v_total_due int; v_total_paid int; v_on_time int; v_late int; v_avg_delay numeric(6,2); v_cycles int;
        v_score int; v_tier public.reliability_tier; v_pay_rate numeric; v_on_time_rate numeric; v_penalty int;
        v_row public.user_reliability_scores%rowtype;
begin
  if _user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select count(*) into v_total_due from public.contributions c
    join public.turns t on t.id = c.turn_id
    where c.payer_user_id = _user_id and t.status in ('collecting', 'paid', 'upcoming', 'skipped');
  select count(*) into v_total_paid from public.contributions c where c.payer_user_id = _user_id and c.status = 'confirmed';
  select count(*) filter (where c.confirmed_at::date <= t.due_date),
         count(*) filter (where c.confirmed_at::date >  t.due_date),
         coalesce(avg(greatest(0, (c.confirmed_at::date - t.due_date))) filter (where c.status = 'confirmed'), 0)
  into v_on_time, v_late, v_avg_delay
  from public.contributions c join public.turns t on t.id = c.turn_id
  where c.payer_user_id = _user_id and c.status = 'confirmed';
  select count(distinct cy.id) into v_cycles from public.cycles cy
    join public.turns t on t.cycle_id = cy.id join public.contributions c on c.turn_id = t.id
    where c.payer_user_id = _user_id and c.status = 'confirmed' and cy.ended_at is not null;
  if v_total_due = 0 then v_score := 0; v_tier := 'nouveau';
  else
    v_pay_rate := v_total_paid::numeric / nullif(v_total_due, 0);
    v_on_time_rate := case when v_total_paid > 0 then v_on_time::numeric / v_total_paid else 0 end;
    v_penalty := case when v_avg_delay > 7 then 10 when v_avg_delay > 3 then 5 else 0 end;
    v_score := greatest(0, least(100, round(85 * v_pay_rate + 15 * v_on_time_rate)::int - v_penalty));
    v_tier := case when v_total_paid = 0 then 'nouveau'
                   when v_score >= 85 then 'excellent' when v_score >= 70 then 'bon'
                   when v_score >= 50 then 'moyen' else 'risque' end;
  end if;
  insert into public.user_reliability_scores (user_id, score, tier, total_due, total_paid, total_on_time, total_late, avg_delay_days, cycles_completed, last_computed_at)
  values (_user_id, v_score, v_tier, v_total_due, v_total_paid, v_on_time, v_late, v_avg_delay, v_cycles, now())
  on conflict (user_id) do update set score = excluded.score, tier = excluded.tier, total_due = excluded.total_due,
    total_paid = excluded.total_paid, total_on_time = excluded.total_on_time, total_late = excluded.total_late,
    avg_delay_days = excluded.avg_delay_days, cycles_completed = excluded.cycles_completed, last_computed_at = excluded.last_computed_at
  returning * into v_row;
  return v_row;
end; $$;
grant execute on function public.recompute_reliability(uuid) to authenticated;

create or replace function public.trg_recompute_reliability()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'UPDATE' and NEW.status = 'confirmed' and OLD.status is distinct from 'confirmed')
     or (TG_OP = 'INSERT' and NEW.status = 'confirmed') then
    perform public.recompute_reliability(NEW.payer_user_id);
  end if;
  return NEW;
end; $$;
drop trigger if exists contributions_recompute_reliability on public.contributions;
create trigger contributions_recompute_reliability after insert or update on public.contributions
  for each row execute function public.trg_recompute_reliability();

create or replace view public.my_reliability with (security_invoker = true) as
select * from public.user_reliability_scores where user_id = auth.uid();
grant select on public.my_reliability to authenticated;

create or replace view public.group_reliability with (security_invoker = true) as
select gm.group_id, gm.user_id, p.full_name, coalesce(s.score, 0) as score,
       coalesce(s.tier, 'nouveau'::public.reliability_tier) as tier,
       coalesce(s.total_paid, 0) as total_paid, coalesce(s.total_late, 0) as total_late
from public.group_members gm
left join public.profiles p on p.id = gm.user_id
left join public.user_reliability_scores s on s.user_id = gm.user_id
where gm.status = 'active';
grant select on public.group_reliability to authenticated;

create or replace view public.my_late_contributions with (security_invoker = true) as
select c.id as contribution_id, c.group_id, g.name as group_name, t.turn_number, t.due_date,
       c.confirmed_at, (c.confirmed_at::date - t.due_date) as delay_days, c.amount
from public.contributions c
join public.turns t on t.id = c.turn_id
join public.groups g on g.id = c.group_id
where c.payer_user_id = auth.uid() and c.status = 'confirmed' and c.confirmed_at::date > t.due_date
order by c.confirmed_at desc limit 5;
grant select on public.my_late_contributions to authenticated;

-- ===== 07_phase_f_notifications.sql (enum adds only, triggers in next batch) =====
do $$ begin
  alter type public.notification_kind add value if not exists 'turn_started';
  alter type public.notification_kind add value if not exists 'receipt_ready';
  alter type public.notification_kind add value if not exists 'reliability_changed';
  alter type public.notification_kind add value if not exists 'member_joined';
  alter type public.notification_kind add value if not exists 'contribution_confirmed';
end $$;

alter table public.notifications
  add column if not exists turn_id uuid references public.turns(id) on delete cascade,
  add column if not exists link text;

create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);

notify pgrst, 'reload schema';
