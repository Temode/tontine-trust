-- =====================================================================
-- Tontine Digital — Intégration Djomy (paiements mobile money)
-- Idempotent. À exécuter dans Supabase SQL Editor.
-- =====================================================================

-- 1. Étendre l'enum payment_provider (+ 'djomy')
do $$ begin
  alter type public.payment_provider add value if not exists 'djomy';
exception when others then null; end $$;

-- 2. Étendre la table payments avec les champs Djomy
alter table public.payments
  add column if not exists djomy_transaction_id text,
  add column if not exists djomy_link_reference  text,
  add column if not exists payment_method        text,
  add column if not exists redirect_url          text,
  add column if not exists payer_phone           text,
  add column if not exists metadata              jsonb;

create unique index if not exists payments_djomy_tx_uq
  on public.payments(djomy_transaction_id)
  where djomy_transaction_id is not null;

-- 3. Table payment_links (liens partageables)
create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  contribution_id uuid references public.contributions(id) on delete set null,
  purpose text not null check (purpose in ('contribution','service_fee','custom')),
  amount bigint not null check (amount > 0),
  usage_type text not null default 'UNIQUE' check (usage_type in ('UNIQUE','MULTIPLE')),
  djomy_reference text not null,
  djomy_url text not null,
  status text not null default 'active',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb
);
create unique index if not exists payment_links_djomy_ref_uq on public.payment_links(djomy_reference);
create index if not exists payment_links_group_idx on public.payment_links(group_id);

grant select, insert, update, delete on public.payment_links to authenticated;
grant all on public.payment_links to service_role;
alter table public.payment_links enable row level security;

drop policy if exists payment_links_member_select on public.payment_links;
create policy payment_links_member_select on public.payment_links
  for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.group_id = payment_links.group_id and m.user_id = auth.uid()
  ));

drop policy if exists payment_links_admin_write on public.payment_links;
create policy payment_links_admin_write on public.payment_links
  for all to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.group_id = payment_links.group_id
      and m.user_id = auth.uid()
      and m.role in ('admin','co_admin')
  ))
  with check (exists (
    select 1 from public.memberships m
    where m.group_id = payment_links.group_id
      and m.user_id = auth.uid()
      and m.role in ('admin','co_admin')
  ));

-- 4. Table djomy_webhook_events (idempotence)
create table if not exists public.djomy_webhook_events (
  event_id uuid primary key,
  event_type text not null,
  transaction_id text,
  signature_valid boolean not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
grant all on public.djomy_webhook_events to service_role;
alter table public.djomy_webhook_events enable row level security;
-- (aucune policy : écrit uniquement par service_role depuis l'edge fn)

-- 5. RPC : start_djomy_payment(contribution_id, method, payer_phone)
--    Crée une tentative payments en statut 'initiated'. Renvoie son id.
create or replace function public.start_djomy_payment(
  _contribution_id uuid,
  _method text,
  _payer_phone text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_contrib public.contributions%rowtype;
  v_payment_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_contrib from public.contributions where id = _contribution_id;
  if not found then raise exception 'CONTRIBUTION_NOT_FOUND'; end if;
  if v_contrib.payer_user_id <> v_user then raise exception 'FORBIDDEN'; end if;
  if v_contrib.status = 'confirmed' then raise exception 'ALREADY_PAID'; end if;

  insert into public.payments (
    contribution_id, group_id, user_id, amount, provider,
    status, payment_method, payer_phone, initiated_at
  ) values (
    v_contrib.id, v_contrib.group_id, v_user, v_contrib.amount, 'djomy',
    'initiated', _method, _payer_phone, now()
  ) returning id into v_payment_id;

  return v_payment_id;
end; $$;
grant execute on function public.start_djomy_payment(uuid, text, text) to authenticated;

-- 6. RPC : attach_djomy_reference (appelé par l'edge fn après création Djomy)
create or replace function public.attach_djomy_reference(
  _payment_id uuid,
  _transaction_id text,
  _redirect_url text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.payments
     set djomy_transaction_id = _transaction_id,
         redirect_url = _redirect_url,
         status = 'pending'
   where id = _payment_id;
end; $$;
grant execute on function public.attach_djomy_reference(uuid, text, text) to service_role;

-- 7. RPC : apply_djomy_webhook (appelé par l'edge fn webhook avec service_role)
--    Met à jour le payment, et si succès → confirme la contribution + ledger.
create or replace function public.apply_djomy_webhook(
  _payment_id uuid,
  _new_status text,
  _provider_ref text,
  _paid_amount bigint,
  _payment_method text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments%rowtype;
  v_contrib public.contributions%rowtype;
  v_turn public.turns%rowtype;
  v_remaining int;
begin
  select * into v_payment from public.payments where id = _payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;

  -- Idempotence : ne pas retraiter un paiement déjà succeeded/failed/refunded
  if v_payment.status in ('succeeded','refunded') then
    return;
  end if;

  update public.payments
     set status = _new_status::public.payment_status,
         provider_ref = coalesce(_provider_ref, provider_ref),
         payment_method = coalesce(_payment_method, payment_method),
         settled_at = case when _new_status in ('succeeded','failed','cancelled')
                           then now() else settled_at end
   where id = _payment_id;

  if _new_status <> 'succeeded' then
    return;
  end if;

  -- Succès : confirmer la contribution + ledger + notifications
  select * into v_contrib from public.contributions where id = v_payment.contribution_id;
  if not found or v_contrib.status = 'confirmed' then
    return;
  end if;
  select * into v_turn from public.turns where id = v_contrib.turn_id;

  update public.contributions set
    status = 'confirmed',
    provider = 'djomy',
    reference = coalesce(_provider_ref, v_contrib.reference),
    submitted_at = coalesce(v_contrib.submitted_at, now()),
    confirmed_at = now(),
    confirmed_by = v_payment.user_id
  where id = v_contrib.id;

  perform public.append_ledger(
    v_contrib.group_id, v_turn.cycle_id, v_turn.id, v_contrib.id, v_payment.id,
    v_payment.user_id, 'contribution_in', v_contrib.amount,
    'Cotisation Djomy tour #' || v_turn.turn_number
  );

  select count(*) into v_remaining
    from public.contributions
    where turn_id = v_turn.id and status <> 'confirmed';

  if v_remaining = 0 and v_turn.status <> 'paid' then
    update public.turns
      set status = ('collecting'::public.turn_status)
      where id = v_turn.id and status <> 'paid';

    insert into public.notifications (user_id, kind, title, body, group_id)
    values (v_turn.beneficiary_user_id, 'contribution_received',
      'Cagnotte complète',
      'Toutes les cotisations de votre tour ont été reçues. Versement à venir.',
      v_turn.group_id);
  end if;

  -- Audit best-effort (la fn log_audit existe dans 25_audit_instrumentation)
  begin
    perform public.log_audit(
      v_contrib.group_id, 'djomy_payment_confirmed', 'contribution', v_contrib.id,
      jsonb_build_object('payment_id', v_payment.id, 'amount', _paid_amount,
                         'method', _payment_method, 'provider_ref', _provider_ref)
    );
  exception when others then null; end;
end; $$;
grant execute on function public.apply_djomy_webhook(uuid, text, text, bigint, text) to service_role;

-- Forcer PostgREST à recharger le schéma
notify pgrst, 'reload schema';