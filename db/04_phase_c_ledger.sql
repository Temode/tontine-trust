-- =====================================================================
-- Tontine Digital — Phase C : paiements, ledger immuable, settlement
-- À exécuter dans le SQL Editor de Supabase APRÈS db/03_phase_b_rotation.sql
-- Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type public.payment_status as enum (
    'initiated', 'pending', 'succeeded', 'failed', 'cancelled', 'refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ledger_entry_type as enum (
    'contribution_in', 'payout_out', 'fee', 'refund', 'penalty', 'adjustment'
  );
exception when duplicate_object then null; end $$;

-- 'paid' n'existe pas dans contribution_status; on s'aligne sur 'confirmed'.
-- 'submitted' = paiement en cours (provider).
-- 'confirmed' = paiement reçu (settled).

-- ---------------------------------------------------------------------
-- 2. TABLES
-- ---------------------------------------------------------------------

-- payments : une tentative de paiement (1 contribution => 1..N tentatives)
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
create unique index if not exists payments_provider_ref_uq
  on public.payments(provider, provider_ref) where provider_ref is not null;

-- ledger_entries : registre immuable double-entrée (chaîne de hash)
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
  -- montants signés : crédit positif / débit négatif (du point de vue du groupe)
  amount bigint not null,
  balance_after bigint, -- solde cagnotte du groupe après cette entrée
  memo text,
  prev_hash text,
  hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists ledger_group_seq_idx on public.ledger_entries(group_id, seq);
create index if not exists ledger_payment_idx on public.ledger_entries(payment_id);
create index if not exists ledger_turn_idx on public.ledger_entries(turn_id);

-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------
alter table public.payments       enable row level security;
alter table public.ledger_entries enable row level security;

-- payments : lecture par membre du groupe ; INSERT/UPDATE via RPC seulement
drop policy if exists payments_select_member on public.payments;
create policy payments_select_member on public.payments for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

-- pas d'INSERT/UPDATE/DELETE direct

-- ledger_entries : lecture par membre du groupe ; jamais d'écriture directe
drop policy if exists ledger_select_member on public.ledger_entries;
create policy ledger_select_member on public.ledger_entries for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

-- ---------------------------------------------------------------------
-- 4. HELPER : append_ledger (interne, SECURITY DEFINER)
--    Calcule hash chaîné + balance courante du groupe.
-- ---------------------------------------------------------------------
create or replace function public.append_ledger(
  _group_id uuid,
  _cycle_id uuid,
  _turn_id uuid,
  _contribution_id uuid,
  _payment_id uuid,
  _user_id uuid,
  _entry_type public.ledger_entry_type,
  _amount bigint,
  _memo text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_prev_hash text;
  v_prev_balance bigint;
  v_new_balance bigint;
  v_hash text;
  v_id uuid;
  v_seq bigint;
begin
  select hash, balance_after into v_prev_hash, v_prev_balance
    from public.ledger_entries
    where group_id = _group_id
    order by seq desc limit 1;

  v_new_balance := coalesce(v_prev_balance, 0) + _amount;

  v_hash := encode(
    digest(
      coalesce(v_prev_hash, '') || '|' ||
      _group_id::text || '|' ||
      _entry_type::text || '|' ||
      _amount::text || '|' ||
      coalesce(_payment_id::text, '') || '|' ||
      coalesce(_turn_id::text, '') || '|' ||
      extract(epoch from now())::text,
      'sha256'
    ),
    'hex'
  );

  insert into public.ledger_entries (
    group_id, cycle_id, turn_id, contribution_id, payment_id,
    user_id, entry_type, amount, balance_after, memo, prev_hash, hash
  ) values (
    _group_id, _cycle_id, _turn_id, _contribution_id, _payment_id,
    _user_id, _entry_type, _amount, v_new_balance, _memo, v_prev_hash, v_hash
  ) returning id into v_id;

  return v_id;
end; $$;

-- Activer pgcrypto pour digest()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 5. RPC : record_mock_payment(contribution_id, provider)
--    Simule un paiement Mobile Money réussi.
--    Crée payments(succeeded) + contribution.confirmed + ledger entry.
--    Si toutes contributions du turn sont confirmed => turn.collecting.
-- ---------------------------------------------------------------------
create or replace function public.record_mock_payment(
  _contribution_id uuid,
  _provider public.payment_provider default 'simulation'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_contrib public.contributions%rowtype;
  v_turn public.turns%rowtype;
  v_payment_id uuid;
  v_remaining int;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_contrib from public.contributions where id = _contribution_id;
  if not found then raise exception 'CONTRIBUTION_NOT_FOUND'; end if;

  if v_contrib.payer_user_id <> v_user then
    raise exception 'FORBIDDEN';
  end if;

  if v_contrib.status = 'confirmed' then
    raise exception 'ALREADY_PAID';
  end if;

  select * into v_turn from public.turns where id = v_contrib.turn_id;

  -- 1) enregistre tentative de paiement (succès simulé)
  insert into public.payments (
    contribution_id, group_id, user_id, amount, provider,
    provider_ref, status, initiated_at, settled_at
  ) values (
    v_contrib.id, v_contrib.group_id, v_user, v_contrib.amount, _provider,
    'MOCK-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
    'succeeded', now(), now()
  ) returning id into v_payment_id;

  -- 2) marque la contribution confirmée
  update public.contributions set
    status = 'confirmed',
    provider = _provider,
    reference = (select provider_ref from public.payments where id = v_payment_id),
    submitted_at = now(),
    confirmed_at = now(),
    confirmed_by = v_user
  where id = v_contrib.id;

  -- 3) ledger : entrée crédit (cotisation reçue)
  perform public.append_ledger(
    v_contrib.group_id, v_turn.cycle_id, v_turn.id, v_contrib.id, v_payment_id,
    v_user, 'contribution_in', v_contrib.amount,
    'Cotisation tour #' || v_turn.turn_number
  );

  -- 4) si plus aucune contribution en attente pour ce tour, le turn devient collecting (prêt à verser)
  select count(*) into v_remaining
    from public.contributions
    where turn_id = v_turn.id and status <> 'confirmed';

  if v_remaining = 0 and v_turn.status <> 'paid' then
    update public.turns
      set status = 'collecting'
      where id = v_turn.id and status <> 'paid';

    insert into public.notifications (user_id, kind, title, body, group_id)
    values (v_turn.beneficiary_user_id, 'contribution_received',
      'Cagnotte complète',
      'Toutes les cotisations de votre tour ont été reçues. Versement à venir.',
      v_turn.group_id);
  end if;

  return v_payment_id;
end; $$;

grant execute on function public.record_mock_payment(uuid, public.payment_provider) to authenticated;

-- ---------------------------------------------------------------------
-- 6. VIEW : my_contributions_due  (cotisations à payer pour user courant)
-- ---------------------------------------------------------------------
create or replace view public.my_contributions_due
with (security_invoker = true) as
select
  c.id as contribution_id,
  c.turn_id,
  c.group_id,
  g.name as group_name,
  c.amount,
  c.status,
  t.turn_number,
  t.due_date,
  t.beneficiary_user_id,
  pb.full_name as beneficiary_name,
  (t.due_date - current_date) as days_to_due
from public.contributions c
join public.turns t on t.id = c.turn_id
join public.groups g on g.id = c.group_id
left join public.profiles pb on pb.id = t.beneficiary_user_id
where c.payer_user_id = auth.uid()
  and c.status in ('pending', 'submitted', 'rejected')
  and t.status in ('upcoming', 'collecting')
order by t.due_date asc;

-- ---------------------------------------------------------------------
-- 7. VIEW : my_payments_history (paiements de l'user courant)
-- ---------------------------------------------------------------------
create or replace view public.my_payments_history
with (security_invoker = true) as
select
  p.id as payment_id,
  p.contribution_id,
  p.group_id,
  g.name as group_name,
  p.amount,
  p.provider,
  p.provider_ref,
  p.status,
  p.initiated_at,
  p.settled_at,
  t.turn_number
from public.payments p
join public.groups g on g.id = p.group_id
join public.contributions c on c.id = p.contribution_id
join public.turns t on t.id = c.turn_id
where p.user_id = auth.uid()
order by p.initiated_at desc;

-- =====================================================================
-- Fin Phase C
-- =====================================================================