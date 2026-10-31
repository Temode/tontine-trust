
-- =====================================================================
-- Fix tontine logic: one open turn at a time
-- =====================================================================

-- Helper: get interval in days for a given frequency
create or replace function public.frequency_to_days(_freq public.group_frequency)
returns int language sql immutable as $$
  select case _freq
    when 'quotidienne' then 1
    when 'hebdomadaire' then 7
    when 'quinzaine' then 14
    when 'mensuelle' then 30
  end
$$;

-- ---------------------------------------------------------------------
-- 1. start_cycle: only create contributions for turn 1
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

  v_freq_days := public.frequency_to_days(v_group.frequency);
  if v_freq_days is null then v_freq_days := 7; end if;

  v_payout := v_group.contribution_amount * v_count;
  v_due := current_date + v_freq_days;

  -- Create all turns as planning, but ONLY turn 1 is collecting
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

    -- Contributions are ONLY created for turn 1 here.
    if r.position = 1 then
      insert into public.contributions (
        turn_id, group_id, payer_user_id, amount, status
      )
      select
        (select id from public.turns
           where cycle_id = v_cycle_id and turn_number = 1),
        _group_id, gm.user_id, v_group.contribution_amount,
        'pending'::public.contribution_status
      from public.group_members gm
      where gm.group_id = _group_id
        and gm.status = 'active'
        and gm.user_id <> r.user_id;
    end if;

    v_due := v_due + v_freq_days;
  end loop;

  update public.groups set status = 'active' where id = _group_id;

  insert into public.notifications (user_id, kind, title, body, group_id)
  select gm.user_id, 'cycle_started',
    'Cycle démarré',
    'L''ordre de rotation a été tiré. Premier tour ouvert à la collecte.',
    _group_id
  from public.group_members gm
  where gm.group_id = _group_id and gm.status = 'active';

  return v_cycle_id;
end; $$;

grant execute on function public.start_cycle(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. open_next_turn: helper to open the next upcoming turn after payout
-- ---------------------------------------------------------------------
create or replace function public.open_next_turn(_cycle_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_next public.turns%rowtype;
  v_group public.groups%rowtype;
  v_freq_days int;
begin
  select * into v_next
    from public.turns
    where cycle_id = _cycle_id and status = 'upcoming'
    order by turn_number asc
    limit 1
    for update;

  if not found then
    return null; -- cycle terminé
  end if;

  select * into v_group from public.groups where id = v_next.group_id;
  v_freq_days := public.frequency_to_days(v_group.frequency);
  if v_freq_days is null then v_freq_days := 7; end if;

  -- recalculate due_date based on real "today"
  update public.turns
    set status = 'collecting'::public.turn_status,
        due_date = current_date + v_freq_days
    where id = v_next.id;

  -- generate contributions if not already present
  insert into public.contributions (
    turn_id, group_id, payer_user_id, amount, status
  )
  select v_next.id, v_next.group_id, gm.user_id,
         v_group.contribution_amount, 'pending'::public.contribution_status
  from public.group_members gm
  where gm.group_id = v_next.group_id
    and gm.status = 'active'
    and gm.user_id <> v_next.beneficiary_user_id
    and not exists (
      select 1 from public.contributions c
      where c.turn_id = v_next.id and c.payer_user_id = gm.user_id
    );

  -- notify all active members
  insert into public.notifications (user_id, kind, title, body, group_id)
  select gm.user_id, 'cycle_started',
    'Nouveau tour ouvert',
    'Le tour #' || v_next.turn_number || ' est maintenant ouvert à la collecte.',
    v_next.group_id
  from public.group_members gm
  where gm.group_id = v_next.group_id and gm.status = 'active';

  return v_next.id;
end; $$;

-- ---------------------------------------------------------------------
-- 3. release_payout: at the end, open the next turn
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

  insert into public.payments (
    contribution_id, group_id, user_id, amount, provider,
    provider_ref, status, initiated_at, settled_at
  )
  select c.id, v_turn.group_id, v_turn.beneficiary_user_id, v_total_collected, _provider,
    'PAYOUT-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
    'succeeded', now(), now()
  from public.contributions c
  where c.turn_id = v_turn.id
  order by c.confirmed_at desc nulls last
  limit 1
  returning id into v_payment_id;

  v_ledger_id := public.append_ledger(
    v_turn.group_id, v_turn.cycle_id, v_turn.id, null, v_payment_id,
    v_turn.beneficiary_user_id, 'payout_out', -v_total_collected,
    'Versement tour #' || v_turn.turn_number
  );

  v_receipt_number := 'TD-' || to_char(now(), 'YYYY') || '-' ||
    lpad(nextval('public.receipts_number_seq')::text, 6, '0');

  v_hash := encode(digest(
    v_receipt_number || '|' || v_turn.id::text || '|' || v_payment_id::text ||
    '|' || v_total_collected::text || '|' || extract(epoch from now())::text,
    'sha256'
  ), 'hex');

  insert into public.receipts (
    receipt_number, turn_id, group_id, cycle_id, beneficiary_user_id,
    payment_id, amount, provider, ledger_entry_id, hash, issued_by
  ) values (
    v_receipt_number, v_turn.id, v_turn.group_id, v_turn.cycle_id, v_turn.beneficiary_user_id,
    v_payment_id, v_total_collected, _provider, v_ledger_id, v_hash, v_user
  ) returning id into v_receipt_id;

  update public.turns set status = 'paid', paid_at = now() where id = v_turn.id;

  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_turn.beneficiary_user_id, 'payout_released',
    'Versement effectué',
    'Vous avez reçu votre cagnotte. Le reçu numérique est disponible.',
    v_turn.group_id);

  -- Open the next upcoming turn (or close the cycle if none)
  perform public.open_next_turn(v_turn.cycle_id);

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

-- ---------------------------------------------------------------------
-- 4. my_contributions_due view: only show contributions of OPEN turns
-- ---------------------------------------------------------------------
create or replace view public.my_contributions_due
with (security_invoker = true) as
select c.id as contribution_id,
       c.turn_id,
       c.group_id,
       g.name as group_name,
       c.amount,
       c.status,
       t.turn_number,
       t.due_date,
       t.beneficiary_user_id,
       pb.full_name as beneficiary_name,
       t.due_date - current_date as days_to_due,
       case
         when g.late_penalty_percent > 0
              and (current_date - t.due_date) > g.late_penalty_after_days
           then c.amount * g.late_penalty_percent / 100
         else 0::bigint
       end as expected_penalty
from public.contributions c
join public.turns t on t.id = c.turn_id
join public.groups g on g.id = c.group_id
left join public.profiles pb on pb.id = t.beneficiary_user_id
where c.payer_user_id = auth.uid()
  and c.status = any (array['pending'::public.contribution_status,
                            'submitted'::public.contribution_status,
                            'rejected'::public.contribution_status])
  and t.status = 'collecting'::public.turn_status
order by t.due_date;

-- ---------------------------------------------------------------------
-- 5. Cleanup: remove pre-generated pending contributions of upcoming turns
--    (only contributions with no payments attached are removed).
-- ---------------------------------------------------------------------
delete from public.contributions c
using public.turns t
where c.turn_id = t.id
  and t.status = 'upcoming'
  and c.status = 'pending'
  and not exists (select 1 from public.payments p where p.contribution_id = c.id);
