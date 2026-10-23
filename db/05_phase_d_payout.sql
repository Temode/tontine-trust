-- =====================================================================
-- Tontine Digital — Phase D : versements bénéficiaire + reçus numériques
-- À exécuter dans le SQL Editor de Supabase APRÈS db/04_phase_c_ledger.sql
-- Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Ajout de valeurs d'enum (notification_kind)
-- ---------------------------------------------------------------------
do $$ begin
  alter type public.notification_kind add value if not exists 'payout_released';
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Table : receipts (reçu numérique d'un versement)
-- ---------------------------------------------------------------------
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

alter table public.receipts enable row level security;

drop policy if exists receipts_select_member on public.receipts;
create policy receipts_select_member on public.receipts for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

-- pas d'INSERT/UPDATE/DELETE direct (RPC only)

-- ---------------------------------------------------------------------
-- 3. RPC : release_payout(_turn_id, _provider)
--    Verse la cagnotte au bénéficiaire d'un tour.
--    Conditions : caller organisateur, tour collecting, toutes contributions confirmées.
-- ---------------------------------------------------------------------
create or replace function public.release_payout(
  _turn_id uuid,
  _provider public.payment_provider default 'simulation'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_turn public.turns%rowtype;
  v_remaining int;
  v_total_collected bigint;
  v_payment_id uuid;
  v_receipt_id uuid;
  v_receipt_number text;
  v_ledger_id uuid;
  v_hash text;
  v_remaining_turns int;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_turn from public.turns where id = _turn_id for update;
  if not found then raise exception 'TURN_NOT_FOUND'; end if;

  if not public.is_group_organizer(v_turn.group_id, v_user) then
    raise exception 'FORBIDDEN';
  end if;

  if v_turn.status = 'paid' then
    raise exception 'ALREADY_PAID';
  end if;
  if v_turn.status <> 'collecting' then
    raise exception 'TURN_NOT_READY';
  end if;

  -- toutes les cotisations doivent être confirmées
  select count(*) into v_remaining
    from public.contributions
    where turn_id = v_turn.id and status <> 'confirmed';
  if v_remaining > 0 then
    raise exception 'CONTRIBUTIONS_INCOMPLETE';
  end if;

  select coalesce(sum(amount), 0) into v_total_collected
    from public.contributions
    where turn_id = v_turn.id and status = 'confirmed';

  if v_total_collected <> v_turn.payout_amount then
    raise exception 'AMOUNT_MISMATCH';
  end if;

  -- 1) payment sortant
  insert into public.payments (
    contribution_id, group_id, user_id, amount, provider,
    provider_ref, status, initiated_at, settled_at
  )
  select
    c.id, v_turn.group_id, v_turn.beneficiary_user_id, v_total_collected, _provider,
    'PAYOUT-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
    'succeeded', now(), now()
  from public.contributions c
  where c.turn_id = v_turn.id
  order by c.confirmed_at desc nulls last
  limit 1
  returning id into v_payment_id;

  -- 2) ledger : débit
  v_ledger_id := public.append_ledger(
    v_turn.group_id, v_turn.cycle_id, v_turn.id, null, v_payment_id,
    v_turn.beneficiary_user_id, 'payout_out', -v_total_collected,
    'Versement tour #' || v_turn.turn_number
  );

  -- 3) numéro de reçu : TD-YYYY-NNNNNN
  v_receipt_number := 'TD-' || to_char(now(), 'YYYY') || '-' ||
    lpad(nextval('public.receipts_number_seq')::text, 6, '0');

  v_hash := encode(digest(
    v_receipt_number || '|' || v_turn.id::text || '|' || v_payment_id::text ||
    '|' || v_total_collected::text || '|' || extract(epoch from now())::text,
    'sha256'
  ), 'hex');

  -- 4) receipt
  insert into public.receipts (
    receipt_number, turn_id, group_id, cycle_id, beneficiary_user_id,
    payment_id, amount, provider, ledger_entry_id, hash, issued_by
  ) values (
    v_receipt_number, v_turn.id, v_turn.group_id, v_turn.cycle_id, v_turn.beneficiary_user_id,
    v_payment_id, v_total_collected, _provider, v_ledger_id, v_hash, v_user
  ) returning id into v_receipt_id;

  -- 5) update turn
  update public.turns
    set status = 'paid', paid_at = now()
    where id = v_turn.id;

  -- 6) notif au bénéficiaire
  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_turn.beneficiary_user_id, 'payout_released',
    'Versement effectué',
    'Vous avez reçu votre cagnotte. Le reçu numérique est disponible.',
    v_turn.group_id);

  -- 7) si plus aucun tour restant => cycle completed + groupe completed
  select count(*) into v_remaining_turns
    from public.turns
    where cycle_id = v_turn.cycle_id and status <> 'paid';

  if v_remaining_turns = 0 then
    update public.cycles set ended_at = now()
      where id = v_turn.cycle_id and ended_at is null;
    -- on ne ferme pas automatiquement le groupe (relance possible nouveau cycle)
  end if;

  return v_receipt_id;
end; $$;

grant execute on function public.release_payout(uuid, public.payment_provider) to authenticated;

-- ---------------------------------------------------------------------
-- 4. VIEW : group_ledger_view (ledger lisible)
-- ---------------------------------------------------------------------
create or replace view public.group_ledger_view
with (security_invoker = true) as
select
  l.id,
  l.seq,
  l.group_id,
  l.turn_id,
  l.payment_id,
  l.user_id,
  l.entry_type,
  l.amount,
  l.balance_after,
  l.memo,
  l.created_at,
  p.full_name as user_name,
  t.turn_number
from public.ledger_entries l
left join public.profiles p on p.id = l.user_id
left join public.turns t on t.id = l.turn_id
order by l.group_id, l.seq desc;

-- ---------------------------------------------------------------------
-- 5. VIEW : my_receipts (reçus dont je suis bénéficiaire)
-- ---------------------------------------------------------------------
create or replace view public.my_receipts
with (security_invoker = true) as
select
  r.id,
  r.receipt_number,
  r.turn_id,
  r.group_id,
  g.name as group_name,
  r.amount,
  r.provider,
  r.hash,
  r.issued_at,
  t.turn_number,
  r.beneficiary_user_id,
  pb.full_name as beneficiary_name,
  pi.full_name as issued_by_name
from public.receipts r
join public.groups g on g.id = r.group_id
join public.turns t on t.id = r.turn_id
left join public.profiles pb on pb.id = r.beneficiary_user_id
left join public.profiles pi on pi.id = r.issued_by
where r.beneficiary_user_id = auth.uid()
order by r.issued_at desc;

-- ---------------------------------------------------------------------
-- 6. VIEW : turn_settlement (état de collecte d'un tour)
-- ---------------------------------------------------------------------
create or replace view public.turn_settlement
with (security_invoker = true) as
select
  t.id as turn_id,
  t.group_id,
  t.cycle_id,
  t.turn_number,
  t.status,
  t.beneficiary_user_id,
  t.payout_amount,
  t.due_date,
  t.paid_at,
  (select count(*) from public.contributions c where c.turn_id = t.id) as expected_count,
  (select count(*) from public.contributions c where c.turn_id = t.id and c.status = 'confirmed') as confirmed_count,
  (select coalesce(sum(c.amount),0) from public.contributions c where c.turn_id = t.id and c.status = 'confirmed') as collected_amount,
  (select id from public.receipts r where r.turn_id = t.id) as receipt_id
from public.turns t;

-- =====================================================================
-- Fin Phase D
-- =====================================================================