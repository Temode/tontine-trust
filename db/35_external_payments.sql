-- =====================================================================
-- Phase C1 — Paiements externes (cash / virement / OM-MTN hors-app)
-- Prerequis : db/35a_external_payments_enum_prelude.sql exécuté.
-- Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table : preuves de paiement externe
-- ---------------------------------------------------------------------
create table if not exists public.external_payment_proofs (
  id              uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.contributions(id) on delete cascade,
  group_id        uuid not null references public.groups(id) on delete cascade,
  member_user_id  uuid not null references auth.users(id) on delete cascade,
  amount          bigint not null check (amount > 0),
  method          public.payment_method_external not null,
  reference       text,
  proof_url       text,
  note            text,
  status          public.external_proof_status not null default 'pending',
  recorded_by     uuid not null references auth.users(id) on delete restrict,
  recorded_at     timestamptz not null default now(),
  reviewed_by     uuid references auth.users(id) on delete set null,
  reviewed_at     timestamptz,
  reject_reason   text
);
create index if not exists epp_group_idx on public.external_payment_proofs(group_id, status);
create index if not exists epp_member_idx on public.external_payment_proofs(member_user_id);
create index if not exists epp_contrib_idx on public.external_payment_proofs(contribution_id);

grant select, insert, update on public.external_payment_proofs to authenticated;
grant all on public.external_payment_proofs to service_role;

alter table public.external_payment_proofs enable row level security;

drop policy if exists epp_select on public.external_payment_proofs;
create policy epp_select on public.external_payment_proofs for select to authenticated
  using (
    member_user_id = auth.uid()
    or public.has_admin_permission(group_id, auth.uid(), 'can_confirm_payments')
    or public.is_group_organizer(group_id, auth.uid())
  );

-- INSERT/UPDATE/DELETE direct interdits : tout passe par RPC SECURITY DEFINER.

-- ---------------------------------------------------------------------
-- 2. RPC : submit_external_payment
-- ---------------------------------------------------------------------
create or replace function public.submit_external_payment(
  _contribution_id uuid,
  _amount          bigint,
  _method          public.payment_method_external,
  _reference       text default null,
  _proof_url       text default null,
  _note            text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_contrib public.contributions%rowtype;
  v_proof_id uuid;
  v_is_admin boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if _amount is null or _amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  select * into v_contrib from public.contributions where id = _contribution_id;
  if not found then raise exception 'CONTRIBUTION_NOT_FOUND'; end if;

  v_is_admin := public.has_admin_permission(v_contrib.group_id, v_uid, 'can_confirm_payments');
  if v_contrib.payer_user_id <> v_uid and not v_is_admin then
    raise exception 'FORBIDDEN';
  end if;

  if v_contrib.status = 'confirmed' then raise exception 'ALREADY_PAID'; end if;

  insert into public.external_payment_proofs (
    contribution_id, group_id, member_user_id, amount, method,
    reference, proof_url, note, recorded_by
  ) values (
    v_contrib.id, v_contrib.group_id, v_contrib.payer_user_id, _amount, _method,
    _reference, _proof_url, _note, v_uid
  ) returning id into v_proof_id;

  -- Notif aux admins du groupe
  insert into public.notifications (user_id, kind, title, body, group_id, data)
  select gm.user_id, 'external_payment_submitted',
         'Preuve de paiement à valider',
         'Une preuve de paiement externe a été soumise.',
         v_contrib.group_id,
         jsonb_build_object('proof_id', v_proof_id, 'amount', _amount, 'method', _method)
  from public.group_members gm
  where gm.group_id = v_contrib.group_id
    and gm.status = 'active'
    and (gm.role = 'organisateur'
         or public.has_admin_permission(v_contrib.group_id, gm.user_id, 'can_confirm_payments'));

  perform public.log_audit(
    v_contrib.group_id, 'external_payment_submitted', 'external_payment_proof', v_proof_id,
    jsonb_build_object('contribution_id', _contribution_id, 'amount', _amount, 'method', _method)
  );
  return v_proof_id;
end; $$;
grant execute on function public.submit_external_payment(
  uuid, bigint, public.payment_method_external, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------
-- 3. RPC : confirm_external_payment
-- ---------------------------------------------------------------------
create or replace function public.confirm_external_payment(_proof_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_proof public.external_payment_proofs%rowtype;
  v_turn  public.turns%rowtype;
  v_remaining int;
  v_payment_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_proof from public.external_payment_proofs where id = _proof_id;
  if not found then raise exception 'PROOF_NOT_FOUND'; end if;

  if not public.has_admin_permission(v_proof.group_id, v_uid, 'can_confirm_payments') then
    raise exception 'FORBIDDEN';
  end if;
  if v_proof.status <> 'pending' then raise exception 'ALREADY_REVIEWED'; end if;

  select * into v_turn from public.turns
    where id = (select turn_id from public.contributions where id = v_proof.contribution_id);

  -- Trace payment côté ledger (provider = cash car mock; le ledger porte la cotisation)
  insert into public.payments (
    contribution_id, group_id, user_id, amount, provider,
    provider_ref, status, initiated_at, settled_at
  ) values (
    v_proof.contribution_id, v_proof.group_id, v_proof.member_user_id, v_proof.amount, 'cash',
    'EXT-' || substr(replace(_proof_id::text, '-', ''), 1, 16),
    'succeeded', now(), now()
  ) returning id into v_payment_id;

  update public.contributions set
    status = 'confirmed',
    provider = 'cash',
    reference = coalesce(v_proof.reference, 'EXT-' || substr(_proof_id::text, 1, 8)),
    submitted_at = coalesce(submitted_at, now()),
    confirmed_at = now(),
    confirmed_by = v_uid
  where id = v_proof.contribution_id;

  update public.external_payment_proofs
    set status='confirmed', reviewed_by=v_uid, reviewed_at=now()
    where id = _proof_id;

  perform public.append_ledger(
    v_proof.group_id, v_turn.cycle_id, v_turn.id, v_proof.contribution_id, v_payment_id,
    v_proof.member_user_id, 'contribution_in', v_proof.amount,
    'Paiement externe confirmé (tour #' || v_turn.turn_number || ')'
  );

  -- Notif au payeur
  insert into public.notifications (user_id, kind, title, body, group_id, data)
  values (v_proof.member_user_id, 'payment_confirmed_by_admin',
    'Paiement confirmé',
    'Votre paiement externe a été validé par un administrateur.',
    v_proof.group_id,
    jsonb_build_object('proof_id', _proof_id, 'amount', v_proof.amount));

  -- Bascule du tour si toutes les cotisations sont reçues
  select count(*) into v_remaining
    from public.contributions
    where turn_id = v_turn.id and status <> 'confirmed';
  if v_remaining = 0 and v_turn.status <> 'paid' then
    update public.turns set status='collecting'::public.turn_status
     where id = v_turn.id and status <> 'paid';
  end if;

  -- Recompute reliability
  begin perform public.recompute_reliability(v_proof.member_user_id); exception when others then null; end;

  perform public.log_audit(
    v_proof.group_id, 'external_payment_confirmed', 'external_payment_proof', _proof_id,
    jsonb_build_object('contribution_id', v_proof.contribution_id, 'amount', v_proof.amount)
  );
end; $$;
grant execute on function public.confirm_external_payment(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. RPC : reject_external_payment
-- ---------------------------------------------------------------------
create or replace function public.reject_external_payment(_proof_id uuid, _reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_proof public.external_payment_proofs%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_proof from public.external_payment_proofs where id = _proof_id;
  if not found then raise exception 'PROOF_NOT_FOUND'; end if;
  if not public.has_admin_permission(v_proof.group_id, v_uid, 'can_confirm_payments') then
    raise exception 'FORBIDDEN';
  end if;
  if v_proof.status <> 'pending' then raise exception 'ALREADY_REVIEWED'; end if;

  update public.external_payment_proofs
    set status='rejected', reviewed_by=v_uid, reviewed_at=now(), reject_reason=_reason
    where id = _proof_id;

  insert into public.notifications (user_id, kind, title, body, group_id, data)
  values (v_proof.member_user_id, 'payment_rejected_by_admin',
    'Preuve de paiement refusée',
    coalesce(_reason, 'Votre preuve de paiement externe a été refusée.'),
    v_proof.group_id, jsonb_build_object('proof_id', _proof_id));

  perform public.log_audit(
    v_proof.group_id, 'external_payment_rejected', 'external_payment_proof', _proof_id,
    jsonb_build_object('contribution_id', v_proof.contribution_id, 'reason', _reason)
  );
end; $$;
grant execute on function public.reject_external_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Storage bucket : payment-proofs (privé)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists "pp_read" on storage.objects;
create policy "pp_read" on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      -- Lecture : payeur (chemin = {group_id}/{user_id}/...) ou admin du groupe
      (split_part(name, '/', 2)::uuid = auth.uid())
      or public.has_admin_permission(split_part(name, '/', 1)::uuid, auth.uid(), 'can_confirm_payments')
    )
  );

drop policy if exists "pp_write" on storage.objects;
create policy "pp_write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and split_part(name, '/', 2)::uuid = auth.uid()
    and public.is_group_member(split_part(name, '/', 1)::uuid, auth.uid())
  );