-- =====================================================================
-- P1.6 — Instrumentation du journal d'audit
-- Redéfinit les 5 RPC sensibles pour qu'elles appellent log_audit().
-- Aucune modification de logique métier : uniquement des appends.
-- À exécuter dans le SQL Editor APRÈS db/24_audit_log.sql. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. start_cycle
-- ---------------------------------------------------------------------
create or replace function public.start_cycle(_group_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_group public.groups%rowtype;
  v_count int;
  v_cycle_id uuid;
  v_cycle_number int;
  v_freq_days int;
  v_payout bigint;
  v_due date;
  r record;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_group from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if not public.is_group_organizer(_group_id, v_user) then
    raise exception 'FORBIDDEN';
  end if;
  if v_group.status not in ('draft','open') then
    raise exception 'CYCLE_ALREADY_STARTED';
  end if;

  select count(*) into v_count from public.group_members
    where group_id = _group_id and status = 'active';
  if v_count < 2 then raise exception 'QUORUM_NOT_REACHED'; end if;

  if v_group.rotation_order_kind = 'random' then
    with shuffled as (
      select id, row_number() over (order by random()) as rn
      from public.group_members
      where group_id = _group_id and status = 'active'
    )
    update public.group_members gm set position = s.rn
    from shuffled s where gm.id = s.id;
  else
    with ordered as (
      select id, row_number() over (
        order by position nulls last, joined_at
      ) as rn
      from public.group_members
      where group_id = _group_id and status = 'active'
    )
    update public.group_members gm set position = o.rn
    from ordered o where gm.id = o.id;
  end if;

  select coalesce(max(cycle_number), 0) + 1 into v_cycle_number
    from public.cycles where group_id = _group_id;

  insert into public.cycles (group_id, cycle_number, started_at)
  values (_group_id, v_cycle_number, now())
  returning id into v_cycle_id;

  v_freq_days := case v_group.frequency
    when 'hebdomadaire' then 7
    when 'quinzaine' then 14
    when 'mensuelle' then 30
  end;

  v_payout := v_group.contribution_amount * v_count;
  v_due := current_date + v_freq_days;

  for r in
    select user_id, position
    from public.group_members
    where group_id = _group_id and status = 'active'
    order by position
  loop
    insert into public.turns (
      cycle_id, group_id, beneficiary_user_id,
      turn_number, due_date, payout_amount, status
    ) values (
      v_cycle_id, _group_id, r.user_id,
      r.position, v_due, v_payout,
      (case when r.position = 1 then 'collecting' else 'upcoming' end)::public.turn_status
    );

    insert into public.contributions (
      turn_id, group_id, payer_user_id, amount, status
    )
    select
      (select id from public.turns
         where cycle_id = v_cycle_id and turn_number = r.position),
      _group_id, gm.user_id, v_group.contribution_amount,
      'pending'::public.contribution_status
    from public.group_members gm
    where gm.group_id = _group_id
      and gm.status = 'active'
      and gm.user_id <> r.user_id;

    v_due := v_due + v_freq_days;
  end loop;

  update public.groups set status = 'active' where id = _group_id;

  insert into public.notifications (user_id, kind, title, body, group_id)
  select gm.user_id, 'cycle_started',
    'Cycle démarré',
    'L''ordre de rotation a été tiré. Premier tour planifié.',
    _group_id
  from public.group_members gm
  where gm.group_id = _group_id and gm.status = 'active';

  perform public.log_audit(
    _group_id, 'start_cycle', 'cycle', v_cycle_id,
    jsonb_build_object('members_count', v_count, 'total_turns', v_count,
                       'payout_amount', v_payout)
  );

  return v_cycle_id;
end; $$;

grant execute on function public.start_cycle(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. approve_member
-- ---------------------------------------------------------------------
create or replace function public.approve_member(_member_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_member public.group_members%rowtype;
  v_active int;
  v_max int;
  v_next_pos int;
  v_name text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_member from public.group_members where id = _member_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;

  if not public.is_group_organizer(v_member.group_id, v_user) then
    raise exception 'FORBIDDEN';
  end if;

  if v_member.status <> 'pending' then
    raise exception 'NOT_PENDING';
  end if;

  select max_members into v_max from public.groups where id = v_member.group_id;
  select count(*) into v_active from public.group_members
    where group_id = v_member.group_id and status = 'active';
  if v_active >= v_max then raise exception 'GROUP_FULL'; end if;

  select coalesce(max(position), 0) + 1 into v_next_pos
    from public.group_members where group_id = v_member.group_id and status = 'active';

  update public.group_members
    set status = 'active', position = v_next_pos
    where id = _member_id;

  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_member.user_id, 'invitation_accepted',
    'Candidature acceptée',
    'Votre demande d''adhésion au groupe a été acceptée.',
    v_member.group_id);

  select full_name into v_name from public.profiles where id = v_member.user_id;
  perform public.log_audit(
    v_member.group_id, 'approve_member', 'group_member', _member_id,
    jsonb_build_object('user_id', v_member.user_id, 'full_name', v_name,
                       'position', v_next_pos)
  );
end; $$;

grant execute on function public.approve_member(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. reject_member
-- ---------------------------------------------------------------------
create or replace function public.reject_member(_member_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_member public.group_members%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_member from public.group_members where id = _member_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;

  if not public.is_group_organizer(v_member.group_id, v_user) then
    raise exception 'FORBIDDEN';
  end if;

  if v_member.status <> 'pending' then raise exception 'NOT_PENDING'; end if;

  update public.group_members set status = 'removed' where id = _member_id;

  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_member.user_id, 'system',
    'Candidature refusée',
    'Votre demande d''adhésion au groupe a été refusée.',
    v_member.group_id);

  perform public.log_audit(
    v_member.group_id, 'reject_member', 'group_member', _member_id,
    jsonb_build_object('user_id', v_member.user_id)
  );
end; $$;

grant execute on function public.reject_member(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. update_group_settings
-- ---------------------------------------------------------------------
create or replace function public.update_group_settings(
  _group_id uuid,
  _payload  jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_status public.group_status;
  v_changed text[] := array[]::text[];
  k text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_group_organizer(_group_id, v_user) then
    raise exception 'FORBIDDEN';
  end if;

  select status into v_status from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if v_status not in ('draft', 'open') then
    raise exception 'CYCLE_ALREADY_STARTED';
  end if;

  if _payload ? 'name' and coalesce(_payload->>'name','') = '' then
    raise exception 'NAME_REQUIRED';
  end if;
  if _payload ? 'contribution_amount'
     and coalesce((_payload->>'contribution_amount')::bigint, 0) <= 0 then
    raise exception 'INVALID_CONTRIBUTION';
  end if;
  if _payload ? 'max_members'
     and coalesce((_payload->>'max_members')::int, 0) < 2 then
    raise exception 'INVALID_MAX_MEMBERS';
  end if;

  for k in select jsonb_object_keys(_payload) loop
    v_changed := array_append(v_changed, k);
  end loop;

  update public.groups set
    name = coalesce(nullif(_payload->>'name',''), name),
    description = case
      when _payload ? 'description' then nullif(_payload->>'description','')
      else description end,
    category = case
      when _payload ? 'category' then nullif(_payload->>'category','')
      else category end,
    contribution_amount = coalesce(
      (_payload->>'contribution_amount')::bigint, contribution_amount),
    frequency = coalesce(
      (_payload->>'frequency')::public.group_frequency, frequency),
    max_members = coalesce(
      (_payload->>'max_members')::int, max_members),
    rotation_order_kind = coalesce(
      (_payload->>'rotation_order_kind')::public.rotation_order, rotation_order_kind),
    late_penalty_percent = coalesce(
      (_payload->>'late_penalty_percent')::int, late_penalty_percent),
    late_penalty_after_days = coalesce(
      (_payload->>'late_penalty_after_days')::int, late_penalty_after_days),
    visibility = coalesce(
      (_payload->>'visibility')::public.group_visibility, visibility),
    updated_at = now()
  where id = _group_id;

  perform public.log_audit(
    _group_id, 'update_group_settings', 'group', _group_id,
    jsonb_build_object('changed_fields', v_changed)
  );
end; $$;

grant execute on function public.update_group_settings(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 5. record_mock_payment
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
  v_group public.groups%rowtype;
  v_payment_id uuid;
  v_remaining int;
  v_penalty bigint := 0;
  v_total bigint;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_contrib from public.contributions where id = _contribution_id;
  if not found then raise exception 'CONTRIBUTION_NOT_FOUND'; end if;
  if v_contrib.payer_user_id <> v_user then raise exception 'FORBIDDEN'; end if;
  if v_contrib.status = 'confirmed' then raise exception 'ALREADY_PAID'; end if;

  select * into v_turn  from public.turns  where id = v_contrib.turn_id;
  select * into v_group from public.groups where id = v_contrib.group_id;

  if v_group.late_penalty_percent > 0
     and (current_date - v_turn.due_date) > v_group.late_penalty_after_days then
    v_penalty := (v_contrib.amount * v_group.late_penalty_percent) / 100;
  end if;
  v_total := v_contrib.amount + v_penalty;

  insert into public.payments (
    contribution_id, group_id, user_id, amount, provider,
    provider_ref, status, initiated_at, settled_at
  ) values (
    v_contrib.id, v_contrib.group_id, v_user, v_total, _provider,
    'MOCK-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
    'succeeded', now(), now()
  ) returning id into v_payment_id;

  update public.contributions set
    status = 'confirmed',
    provider = _provider,
    reference = (select provider_ref from public.payments where id = v_payment_id),
    penalty_amount = v_penalty,
    submitted_at = now(),
    confirmed_at = now(),
    confirmed_by = v_user
  where id = v_contrib.id;

  perform public.append_ledger(
    v_contrib.group_id, v_turn.cycle_id, v_turn.id, v_contrib.id, v_payment_id,
    v_user, 'contribution_in', v_contrib.amount,
    'Cotisation tour #' || v_turn.turn_number
  );

  if v_penalty > 0 then
    perform public.append_ledger(
      v_contrib.group_id, v_turn.cycle_id, v_turn.id, v_contrib.id, v_payment_id,
      v_user, 'penalty', v_penalty,
      'Pénalité de retard (' || v_group.late_penalty_percent || '%)'
    );
  end if;

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

  perform public.log_audit(
    v_contrib.group_id, 'record_payment', 'contribution', v_contrib.id,
    jsonb_build_object('amount', v_contrib.amount, 'penalty_amount', v_penalty,
                       'total', v_total, 'provider', _provider::text,
                       'turn_id', v_turn.id, 'payment_id', v_payment_id)
  );

  return v_payment_id;
end; $$;

grant execute on function public.record_mock_payment(uuid, public.payment_provider) to authenticated;

-- ---------------------------------------------------------------------
-- 6. release_payout
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

  v_fee := (v_total_collected * 1) / 100;
  v_net := v_total_collected - v_fee;

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

  v_ledger_id := public.append_ledger(
    v_turn.group_id, v_turn.cycle_id, v_turn.id, null, v_payment_id,
    v_turn.beneficiary_user_id, 'payout_out', -v_net,
    'Versement tour #' || v_turn.turn_number
  );

  if v_fee > 0 then
    perform public.append_ledger(
      v_turn.group_id, v_turn.cycle_id, v_turn.id, null, v_payment_id,
      null, 'fee', -v_fee,
      'Commission plateforme (1%)'
    );
  end if;

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

  update public.turns set status = 'paid', paid_at = now() where id = v_turn.id;

  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_turn.beneficiary_user_id, 'payout_released',
    'Versement effectué',
    'Vous avez reçu votre cagnotte. Le reçu numérique est disponible.',
    v_turn.group_id);

  select count(*) into v_remaining_turns
    from public.turns
    where cycle_id = v_turn.cycle_id and status <> 'paid';

  if v_remaining_turns = 0 then
    update public.cycles set ended_at = now()
      where id = v_turn.cycle_id and ended_at is null;
  end if;

  perform public.log_audit(
    v_turn.group_id, 'release_payout', 'turn', v_turn.id,
    jsonb_build_object('turn_number', v_turn.turn_number, 'gross', v_total_collected,
                       'fee', v_fee, 'net', v_net, 'receipt_id', v_receipt_id,
                       'receipt_number', v_receipt_number,
                       'beneficiary_user_id', v_turn.beneficiary_user_id)
  );

  return v_receipt_id;
end; $$;

grant execute on function public.release_payout(uuid, public.payment_provider) to authenticated;
