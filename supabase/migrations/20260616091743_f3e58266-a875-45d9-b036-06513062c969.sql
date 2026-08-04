
-- ============ db/35 external_payments ============
create table if not exists public.external_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.contributions(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount > 0),
  method public.payment_method_external not null,
  reference text, proof_url text, note text,
  status public.external_proof_status not null default 'pending',
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reject_reason text
);
create index if not exists epp_group_idx on public.external_payment_proofs(group_id, status);
create index if not exists epp_member_idx on public.external_payment_proofs(member_user_id);
create index if not exists epp_contrib_idx on public.external_payment_proofs(contribution_id);
grant select, insert, update on public.external_payment_proofs to authenticated;
grant all on public.external_payment_proofs to service_role;
alter table public.external_payment_proofs enable row level security;
drop policy if exists epp_select on public.external_payment_proofs;
create policy epp_select on public.external_payment_proofs for select to authenticated
  using (member_user_id = auth.uid()
    or public.has_admin_permission(group_id, auth.uid(), 'can_confirm_payments')
    or public.is_group_organizer(group_id, auth.uid()));

create or replace function public.submit_external_payment(
  _contribution_id uuid, _amount bigint, _method public.payment_method_external,
  _reference text default null, _proof_url text default null, _note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_contrib public.contributions%rowtype;
  v_proof_id uuid; v_is_admin boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if _amount is null or _amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select * into v_contrib from public.contributions where id = _contribution_id;
  if not found then raise exception 'CONTRIBUTION_NOT_FOUND'; end if;
  v_is_admin := public.has_admin_permission(v_contrib.group_id, v_uid, 'can_confirm_payments');
  if v_contrib.payer_user_id <> v_uid and not v_is_admin then raise exception 'FORBIDDEN'; end if;
  if v_contrib.status = 'confirmed' then raise exception 'ALREADY_PAID'; end if;
  insert into public.external_payment_proofs (
    contribution_id, group_id, member_user_id, amount, method,
    reference, proof_url, note, recorded_by
  ) values (
    v_contrib.id, v_contrib.group_id, v_contrib.payer_user_id, _amount, _method,
    _reference, _proof_url, _note, v_uid
  ) returning id into v_proof_id;
  insert into public.notifications (user_id, kind, title, body, group_id, data)
  select gm.user_id, 'external_payment_submitted',
         'Preuve de paiement à valider', 'Une preuve de paiement externe a été soumise.',
         v_contrib.group_id,
         jsonb_build_object('proof_id', v_proof_id, 'amount', _amount, 'method', _method)
  from public.group_members gm
  where gm.group_id = v_contrib.group_id and gm.status = 'active'
    and (gm.role = 'organisateur'
         or public.has_admin_permission(v_contrib.group_id, gm.user_id, 'can_confirm_payments'));
  perform public.log_audit(v_contrib.group_id, 'external_payment_submitted',
    'external_payment_proof', v_proof_id,
    jsonb_build_object('contribution_id', _contribution_id, 'amount', _amount, 'method', _method));
  return v_proof_id;
end; $$;
grant execute on function public.submit_external_payment(
  uuid, bigint, public.payment_method_external, text, text, text) to authenticated;

create or replace function public.confirm_external_payment(_proof_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_proof public.external_payment_proofs%rowtype;
  v_turn public.turns%rowtype; v_remaining int; v_payment_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_proof from public.external_payment_proofs where id = _proof_id;
  if not found then raise exception 'PROOF_NOT_FOUND'; end if;
  if not public.has_admin_permission(v_proof.group_id, v_uid, 'can_confirm_payments') then
    raise exception 'FORBIDDEN'; end if;
  if v_proof.status <> 'pending' then raise exception 'ALREADY_REVIEWED'; end if;
  select * into v_turn from public.turns
    where id = (select turn_id from public.contributions where id = v_proof.contribution_id);
  insert into public.payments (contribution_id, group_id, user_id, amount, provider,
    provider_ref, status, initiated_at, settled_at)
  values (v_proof.contribution_id, v_proof.group_id, v_proof.member_user_id, v_proof.amount, 'cash',
    'EXT-' || substr(replace(_proof_id::text, '-', ''), 1, 16), 'succeeded', now(), now())
  returning id into v_payment_id;
  update public.contributions set status='confirmed', provider='cash',
    reference=coalesce(v_proof.reference, 'EXT-' || substr(_proof_id::text, 1, 8)),
    submitted_at=coalesce(submitted_at, now()), confirmed_at=now(), confirmed_by=v_uid
    where id = v_proof.contribution_id;
  update public.external_payment_proofs set status='confirmed', reviewed_by=v_uid, reviewed_at=now()
    where id = _proof_id;
  perform public.append_ledger(v_proof.group_id, v_turn.cycle_id, v_turn.id,
    v_proof.contribution_id, v_payment_id, v_proof.member_user_id, 'contribution_in', v_proof.amount,
    'Paiement externe confirmé (tour #' || v_turn.turn_number || ')');
  insert into public.notifications (user_id, kind, title, body, group_id, data)
  values (v_proof.member_user_id, 'payment_confirmed_by_admin', 'Paiement confirmé',
    'Votre paiement externe a été validé par un administrateur.',
    v_proof.group_id, jsonb_build_object('proof_id', _proof_id, 'amount', v_proof.amount));
  select count(*) into v_remaining from public.contributions
    where turn_id = v_turn.id and status <> 'confirmed';
  if v_remaining = 0 and v_turn.status <> 'paid' then
    update public.turns set status='collecting'::public.turn_status
     where id = v_turn.id and status <> 'paid';
  end if;
  begin perform public.recompute_reliability(v_proof.member_user_id); exception when others then null; end;
  perform public.log_audit(v_proof.group_id, 'external_payment_confirmed',
    'external_payment_proof', _proof_id,
    jsonb_build_object('contribution_id', v_proof.contribution_id, 'amount', v_proof.amount));
end; $$;
grant execute on function public.confirm_external_payment(uuid) to authenticated;

create or replace function public.reject_external_payment(_proof_id uuid, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_proof public.external_payment_proofs%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_proof from public.external_payment_proofs where id = _proof_id;
  if not found then raise exception 'PROOF_NOT_FOUND'; end if;
  if not public.has_admin_permission(v_proof.group_id, v_uid, 'can_confirm_payments') then
    raise exception 'FORBIDDEN'; end if;
  if v_proof.status <> 'pending' then raise exception 'ALREADY_REVIEWED'; end if;
  update public.external_payment_proofs set status='rejected', reviewed_by=v_uid,
    reviewed_at=now(), reject_reason=_reason where id = _proof_id;
  insert into public.notifications (user_id, kind, title, body, group_id, data)
  values (v_proof.member_user_id, 'payment_rejected_by_admin', 'Preuve de paiement refusée',
    coalesce(_reason, 'Votre preuve de paiement externe a été refusée.'),
    v_proof.group_id, jsonb_build_object('proof_id', _proof_id));
  perform public.log_audit(v_proof.group_id, 'external_payment_rejected',
    'external_payment_proof', _proof_id,
    jsonb_build_object('contribution_id', v_proof.contribution_id, 'reason', _reason));
end; $$;
grant execute on function public.reject_external_payment(uuid, text) to authenticated;

-- ============ db/36 penalty_management ============
alter table public.contributions
  add column if not exists penalty_waived_at timestamptz,
  add column if not exists penalty_waived_by uuid references auth.users(id),
  add column if not exists penalty_waive_reason text,
  add column if not exists penalty_adjusted_from bigint,
  add column if not exists penalty_adjusted_by uuid references auth.users(id),
  add column if not exists penalty_adjusted_at timestamptz,
  add column if not exists penalty_adjust_reason text;

create or replace function public.waive_penalty(_contribution_id uuid, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_c public.contributions%rowtype; v_old bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_c from public.contributions where id = _contribution_id;
  if not found then raise exception 'CONTRIBUTION_NOT_FOUND'; end if;
  if not public.has_admin_permission(v_c.group_id, v_uid, 'can_waive_penalty') then
    raise exception 'FORBIDDEN'; end if;
  if coalesce(v_c.penalty_amount, 0) = 0 then raise exception 'NO_PENALTY'; end if;
  v_old := v_c.penalty_amount;
  update public.contributions set penalty_amount=0, penalty_waived_at=now(),
    penalty_waived_by=v_uid, penalty_waive_reason=_reason where id = _contribution_id;
  insert into public.notifications (user_id, kind, title, body, group_id, data)
  values (v_c.payer_user_id, 'penalty_waived', 'Pénalité annulée',
    coalesce(_reason, 'Un administrateur a annulé votre pénalité de retard.'),
    v_c.group_id, jsonb_build_object('contribution_id', _contribution_id, 'amount', v_old));
  perform public.log_audit(v_c.group_id, 'penalty_waived', 'contribution', _contribution_id,
    jsonb_build_object('amount', v_old, 'reason', _reason));
end; $$;
grant execute on function public.waive_penalty(uuid, text) to authenticated;

create or replace function public.adjust_penalty(_contribution_id uuid, _new_amount bigint, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_c public.contributions%rowtype; v_old bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if _new_amount is null or _new_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;
  select * into v_c from public.contributions where id = _contribution_id;
  if not found then raise exception 'CONTRIBUTION_NOT_FOUND'; end if;
  if not public.has_admin_permission(v_c.group_id, v_uid, 'can_waive_penalty') then
    raise exception 'FORBIDDEN'; end if;
  v_old := coalesce(v_c.penalty_amount, 0);
  update public.contributions set penalty_amount=_new_amount, penalty_adjusted_from=v_old,
    penalty_adjusted_by=v_uid, penalty_adjusted_at=now(), penalty_adjust_reason=_reason
    where id = _contribution_id;
  insert into public.notifications (user_id, kind, title, body, group_id, data)
  values (v_c.payer_user_id, 'penalty_adjusted', 'Pénalité ajustée',
    coalesce(_reason, 'Le montant de votre pénalité a été ajusté.'),
    v_c.group_id, jsonb_build_object('contribution_id', _contribution_id, 'from', v_old, 'to', _new_amount));
  perform public.log_audit(v_c.group_id, 'penalty_adjusted', 'contribution', _contribution_id,
    jsonb_build_object('from', v_old, 'to', _new_amount, 'reason', _reason));
end; $$;
grant execute on function public.adjust_penalty(uuid, bigint, text) to authenticated;
