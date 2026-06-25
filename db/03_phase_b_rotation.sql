-- =====================================================================
-- Tontine Digital — Phase B : workflow candidatures + démarrage cycle
-- À exécuter dans le SQL Editor de Supabase APRÈS db/02_tontine_schema.sql
-- Idempotent : peut être réexécuté sans danger.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enum member_status : ajouter 'pending' (candidature en attente)
-- ---------------------------------------------------------------------
do $$ begin
  alter type public.member_status add value if not exists 'pending';
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. join_group_with_code : passe en 'pending' au lieu d''active'
-- ---------------------------------------------------------------------
create or replace function public.join_group_with_code(_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_invitation public.invitations%rowtype;
  v_user uuid := auth.uid();
  v_active int;
  v_pending int;
  v_max int;
  v_existing public.group_members%rowtype;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

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

  -- déjà membre ?
  select * into v_existing from public.group_members
    where group_id = v_invitation.group_id and user_id = v_user;
  if found then
    if v_existing.status in ('active','pending') then
      return v_invitation.group_id; -- idempotent
    end if;
    -- réintégration après left/removed : repasse en pending
    update public.group_members
      set status = 'pending', position = null
      where id = v_existing.id;
  else
    select max_members into v_max from public.groups where id = v_invitation.group_id;
    select count(*) into v_active from public.group_members
      where group_id = v_invitation.group_id and status = 'active';
    select count(*) into v_pending from public.group_members
      where group_id = v_invitation.group_id and status = 'pending';
    if v_active + v_pending >= v_max then raise exception 'GROUP_FULL'; end if;

    insert into public.group_members (group_id, user_id, role, status, position)
    values (v_invitation.group_id, v_user, 'membre', 'pending', null);
  end if;

  update public.invitations
    set uses_count = uses_count + 1
    where id = v_invitation.id;

  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_invitation.created_by, 'invitation_accepted',
    'Nouvelle candidature',
    'Un utilisateur souhaite rejoindre votre groupe. Validez ou refusez la demande.',
    v_invitation.group_id);

  return v_invitation.group_id;
end; $$;

grant execute on function public.join_group_with_code(text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. RPC : approve_member  (organisateur uniquement)
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
end; $$;

grant execute on function public.approve_member(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. RPC : reject_member  (organisateur uniquement)
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
end; $$;

grant execute on function public.reject_member(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. RPC : start_cycle  (organisateur uniquement)
--   - Vérifie quorum (>=2 membres actifs)
--   - Tirage aléatoire des positions si rotation_order_kind = 'random'
--   - Crée cycle + turns (1 par membre actif) avec due_date séquentielle
--   - Passe group.status à 'active'
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
  v_pos int := 1;
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

  -- (re)assignation des positions
  if v_group.rotation_order_kind = 'random' then
    with shuffled as (
      select id, row_number() over (order by random()) as rn
      from public.group_members
      where group_id = _group_id and status = 'active'
    )
    update public.group_members gm set position = s.rn
    from shuffled s where gm.id = s.id;
  else
    -- fixed/choice : on respecte position existante (NULL en fin)
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

  -- numéro de cycle
  select coalesce(max(cycle_number), 0) + 1 into v_cycle_number
    from public.cycles where group_id = _group_id;

  insert into public.cycles (group_id, cycle_number, started_at)
  values (_group_id, v_cycle_number, now())
  returning id into v_cycle_id;

  -- intervalle entre tours
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
      case when r.position = 1 then 'collecting' else 'upcoming' end
    );

    -- contributions attendues pour ce tour (tous les autres membres)
    insert into public.contributions (
      turn_id, group_id, payer_user_id, amount, status
    )
    select
      (select id from public.turns
         where cycle_id = v_cycle_id and turn_number = r.position),
      _group_id, gm.user_id, v_group.contribution_amount, 'pending'
    from public.group_members gm
    where gm.group_id = _group_id
      and gm.status = 'active'
      and gm.user_id <> r.user_id;

    v_due := v_due + v_freq_days;
  end loop;

  update public.groups set status = 'active' where id = _group_id;

  -- notifie tous les membres actifs
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

-- ---------------------------------------------------------------------
-- 6. Vue : prochain tour de chaque groupe pour un user
-- ---------------------------------------------------------------------
create or replace view public.next_turn_per_group
with (security_invoker = true) as
select distinct on (t.group_id)
  t.group_id,
  t.id as turn_id,
  t.cycle_id,
  t.turn_number,
  t.due_date,
  t.payout_amount,
  t.status,
  t.beneficiary_user_id,
  p.full_name as beneficiary_name
from public.turns t
left join public.profiles p on p.id = t.beneficiary_user_id
where t.status in ('upcoming','collecting')
order by t.group_id, t.due_date asc, t.turn_number asc;

-- =====================================================================
-- Fin Phase B
-- =====================================================================