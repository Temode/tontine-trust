-- =====================================================================
-- P0.3 — Commission plateforme (1%) sur les versements
--   1. Colonnes receipts.fee_amount, receipts.net_amount
--   2. release_payout : prélève la commission, écrit une entrée 'fee'
--   3. Vue my_receipts : expose fee_amount et net_amount
-- À exécuter dans le SQL Editor APRÈS db/17_late_penalties.sql.
-- Idempotent.
-- =====================================================================

alter table public.receipts
  add column if not exists fee_amount bigint not null default 0
    check (fee_amount >= 0),
  add column if not exists net_amount bigint;

-- Backfill : pour les anciens reçus, net = amount.
update public.receipts set net_amount = amount where net_amount is null;

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
  v_fee bigint;
  v_net bigint;
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
  if v_turn.status = 'paid' then raise exception 'ALREADY_PAID'; end if;
  if v_turn.status <> 'collecting' then raise exception 'TURN_NOT_READY'; end if;

  select count(*) into v_remaining
    from public.contributions
    where turn_id = v_turn.id and status <> 'confirmed';
  if v_remaining > 0 then raise exception 'CONTRIBUTIONS_INCOMPLETE'; end if;

  select coalesce(sum(amount), 0) into v_total_collected
    from public.contributions
    where turn_id = v_turn.id and status = 'confirmed';
  if v_total_collected <> v_turn.payout_amount then
    raise exception 'AMOUNT_MISMATCH';
  end if;

  -- Commission plateforme : 1% arrondi à l'entier inférieur (en GNF).
  v_fee := (v_total_collected * 1) / 100;
  v_net := v_total_collected - v_fee;

  -- 1) paiement sortant vers le bénéficiaire (montant net)
  insert into public.payments (
    contribution_id, group_id, user_id, amount, provider,
    provider_ref, status, initiated_at, settled_at
  )
  select
    c.id, v_turn.group_id, v_turn.beneficiary_user_id, v_net, _provider,
    'PAYOUT-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
    'succeeded', now(), now()
  from public.contributions c
  where c.turn_id = v_turn.id
  order by c.confirmed_at desc nulls last
  limit 1
  returning id into v_payment_id;

  -- 2) ledger : débit versement (net)
  v_ledger_id := public.append_ledger(
    v_turn.group_id, v_turn.cycle_id, v_turn.id, null, v_payment_id,
    v_turn.beneficiary_user_id, 'payout_out', -v_net,
    'Versement tour #' || v_turn.turn_number
  );

  -- 3) ledger : commission
  if v_fee > 0 then
    perform public.append_ledger(
      v_turn.group_id, v_turn.cycle_id, v_turn.id, null, v_payment_id,
      null, 'fee', -v_fee,
      'Commission plateforme (1%)'
    );
  end if;

  -- 4) reçu
  v_receipt_number := 'TD-' || to_char(now(), 'YYYY') || '-' ||
    lpad(nextval('public.receipts_number_seq')::text, 6, '0');

  v_hash := encode(digest(
    v_receipt_number || '|' || v_turn.id::text || '|' || v_payment_id::text ||
    '|' || v_net::text || '|' || extract(epoch from now())::text,
    'sha256'
  ), 'hex');

  insert into public.receipts (
    receipt_number, turn_id, group_id, cycle_id, beneficiary_user_id,
    payment_id, amount, fee_amount, net_amount, provider,
    ledger_entry_id, hash, issued_by
  ) values (
    v_receipt_number, v_turn.id, v_turn.group_id, v_turn.cycle_id, v_turn.beneficiary_user_id,
    v_payment_id, v_total_collected, v_fee, v_net, _provider,
    v_ledger_id, v_hash, v_user
  ) returning id into v_receipt_id;

  -- 5) clôture du tour
  update public.turns set status = 'paid', paid_at = now() where id = v_turn.id;

  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_turn.beneficiary_user_id, 'payout_released',
    'Versement effectué',
    'Vous avez reçu votre cagnotte. Le reçu numérique est disponible.',
    v_turn.group_id);

  -- 6) fin de cycle si plus aucun tour restant
  select count(*) into v_remaining_turns
    from public.turns
    where cycle_id = v_turn.cycle_id and status <> 'paid';

  if v_remaining_turns = 0 then
    update public.cycles set ended_at = now()
      where id = v_turn.cycle_id and ended_at is null;
  end if;

  return v_receipt_id;
end; $$;

grant execute on function public.release_payout(uuid, public.payment_provider) to authenticated;

-- Vue : reçus dont je suis bénéficiaire, avec commission et montant net.
create or replace view public.my_receipts
with (security_invoker = true) as
select
  r.id,
  r.receipt_number,
  r.turn_id,
  r.group_id,
  g.name as group_name,
  r.amount,
  r.fee_amount,
  r.net_amount,
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