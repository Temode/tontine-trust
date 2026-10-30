-- =====================================================================
-- Fix : start_cycle insérait des valeurs text dans des colonnes enum
-- Erreur : column "status" is of type turn_status but expression is of type text
-- À exécuter dans le SQL Editor de Supabase. Idempotent.
-- =====================================================================

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

  return v_cycle_id;
end; $$;

grant execute on function public.start_cycle(uuid) to authenticated;