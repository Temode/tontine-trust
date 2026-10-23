-- ===== 07 triggers (les enum values sont déjà committées) =====
create or replace function public.notify(
  _user_id uuid, _kind public.notification_kind, _title text, _body text default null,
  _group_id uuid default null, _turn_id uuid default null, _link text default null, _data jsonb default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if _user_id is null then return null; end if;
  insert into public.notifications (user_id, kind, title, body, group_id, turn_id, link, data)
  values (_user_id, _kind, _title, _body, _group_id, _turn_id, _link, _data)
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.mark_notification_read(_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now() where id = _id and user_id = auth.uid() and read_at is null;
$$;

create or replace function public.mark_all_notifications_read()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.notify(uuid, public.notification_kind, text, text, uuid, uuid, text, jsonb) to authenticated;

create or replace function public.trg_notify_turn_started()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_group_name text;
begin
  if (TG_OP = 'UPDATE' and NEW.status = 'collecting' and OLD.status is distinct from 'collecting')
     or (TG_OP = 'INSERT' and NEW.status = 'collecting') then
    select name into v_group_name from public.groups where id = NEW.group_id;
    for r in select user_id from public.group_members where group_id = NEW.group_id and status = 'active' loop
      perform public.notify(r.user_id, 'turn_started', 'Nouveau tour ouvert',
        format('Tour #%s de %s — cotisez avant l''échéance.', NEW.turn_number, coalesce(v_group_name, 'votre groupe')),
        NEW.group_id, NEW.id, '/groupes/' || NEW.group_id::text, null);
    end loop;
  end if;
  return NEW;
end; $$;
drop trigger if exists turns_notify_started on public.turns;
create trigger turns_notify_started after insert or update of status on public.turns
  for each row execute function public.trg_notify_turn_started();

create or replace function public.trg_notify_payout()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_group_name text;
begin
  if TG_OP = 'UPDATE' and NEW.status = 'paid' and OLD.status is distinct from 'paid' then
    select name into v_group_name from public.groups where id = NEW.group_id;
    perform public.notify(NEW.beneficiary_user_id, 'payout_released', 'Versement reçu',
      format('Vous êtes le bénéficiaire du tour #%s de %s.', NEW.turn_number, coalesce(v_group_name, '')),
      NEW.group_id, NEW.id, '/recus', null);
    perform public.notify(NEW.beneficiary_user_id, 'receipt_ready', 'Reçu disponible',
      'Votre reçu numérique est prêt à être consulté.', NEW.group_id, NEW.id, '/recus', null);
  end if;
  return NEW;
end; $$;
drop trigger if exists turns_notify_payout on public.turns;
create trigger turns_notify_payout after update of status on public.turns
  for each row execute function public.trg_notify_payout();

create or replace function public.trg_notify_contribution_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_group_name text; v_organizer uuid; v_payer_name text;
begin
  if (TG_OP = 'UPDATE' and NEW.status = 'confirmed' and OLD.status is distinct from 'confirmed')
     or (TG_OP = 'INSERT' and NEW.status = 'confirmed') then
    select name, created_by into v_group_name, v_organizer from public.groups where id = NEW.group_id;
    select full_name into v_payer_name from public.profiles where id = NEW.payer_user_id;
    perform public.notify(NEW.payer_user_id, 'contribution_confirmed', 'Cotisation confirmée',
      format('Votre cotisation pour %s a été confirmée.', coalesce(v_group_name, 'le groupe')),
      NEW.group_id, NEW.turn_id, '/groupes/' || NEW.group_id::text, null);
    if v_organizer is not null and v_organizer <> NEW.payer_user_id then
      perform public.notify(v_organizer, 'contribution_received', 'Nouvelle cotisation reçue',
        format('%s a cotisé pour %s.', coalesce(v_payer_name, 'Un membre'), coalesce(v_group_name, 'le groupe')),
        NEW.group_id, NEW.turn_id, '/groupes/' || NEW.group_id::text, null);
    end if;
  end if;
  return NEW;
end; $$;
drop trigger if exists contributions_notify_confirmed on public.contributions;
create trigger contributions_notify_confirmed after insert or update of status on public.contributions
  for each row execute function public.trg_notify_contribution_confirmed();

create or replace function public.trg_notify_reliability_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' and NEW.tier is distinct from OLD.tier then
    perform public.notify(NEW.user_id, 'reliability_changed', 'Votre score de fiabilité a évolué',
      format('Nouveau palier : %s (%s/100).', NEW.tier::text, NEW.score), null, null, '/profil',
      jsonb_build_object('old_tier', OLD.tier, 'new_tier', NEW.tier, 'score', NEW.score));
  end if;
  return NEW;
end; $$;
drop trigger if exists reliability_notify_changed on public.user_reliability_scores;
create trigger reliability_notify_changed after update on public.user_reliability_scores
  for each row execute function public.trg_notify_reliability_changed();

create or replace function public.trg_notify_member_joined()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_group_name text; v_organizer uuid; v_member_name text;
begin
  if NEW.status = 'active' and (TG_OP = 'INSERT' or OLD.status is distinct from 'active') then
    select name, created_by into v_group_name, v_organizer from public.groups where id = NEW.group_id;
    if v_organizer is null or v_organizer = NEW.user_id then return NEW; end if;
    select full_name into v_member_name from public.profiles where id = NEW.user_id;
    perform public.notify(v_organizer, 'member_joined', 'Nouveau membre',
      format('%s a rejoint %s.', coalesce(v_member_name, 'Un membre'), coalesce(v_group_name, 'le groupe')),
      NEW.group_id, null, '/groupes/' || NEW.group_id::text, null);
  end if;
  return NEW;
end; $$;
drop trigger if exists members_notify_joined on public.group_members;
create trigger members_notify_joined after insert or update of status on public.group_members
  for each row execute function public.trg_notify_member_joined();

create or replace view public.my_notifications with (security_invoker = true) as
select n.* from public.notifications n where n.user_id = auth.uid() order by n.created_at desc limit 50;
grant select on public.my_notifications to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; when others then null; end $$;
alter table public.notifications replica identity full;

-- ===== 08_backfill_organizer_membership.sql =====
insert into public.group_members (group_id, user_id, role, status, position)
select g.id, g.created_by, 'organisateur', 'active', 1
from public.groups g
where not exists (select 1 from public.group_members gm where gm.group_id = g.id and gm.user_id = g.created_by)
on conflict (group_id, user_id) do nothing;

-- ===== 09_fix_membership_and_invitations.sql =====
create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id, role, status, position)
  values (new.id, new.created_by, 'organisateur', 'active', 1)
  on conflict (group_id, user_id) do update set role = 'organisateur', status = 'active';
  return new;
end; $$;
drop trigger if exists on_group_created on public.groups;
create trigger on_group_created after insert on public.groups
  for each row execute function public.handle_new_group();

insert into public.group_members (group_id, user_id, role, status, position)
select g.id, g.created_by, 'organisateur', 'active', 1
from public.groups g
where not exists (select 1 from public.group_members gm where gm.group_id = g.id and gm.user_id = g.created_by)
on conflict (group_id, user_id) do nothing;

update public.group_members gm
set role = 'organisateur', status = 'active', position = coalesce(gm.position, 1)
from public.groups g
where gm.group_id = g.id and gm.user_id = g.created_by
  and (gm.role <> 'organisateur' or gm.status <> 'active');

drop policy if exists inv_select_member on public.invitations;
drop policy if exists inv_select_organizer on public.invitations;
create policy inv_select_organizer on public.invitations for select to authenticated
  using (public.is_group_organizer(group_id, auth.uid()));

-- ===== 10_pending_members_visibility.sql =====
create or replace function public.is_group_participant(_group uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = _group and user_id = _user and status in ('active','pending'));
$$;
grant execute on function public.is_group_participant(uuid, uuid) to authenticated;

drop policy if exists groups_select_member on public.groups;
create policy groups_select_member on public.groups for select to authenticated
  using (created_by = auth.uid() or public.is_group_participant(id, auth.uid()));

drop policy if exists gm_select_member on public.group_members;
create policy gm_select_member on public.group_members for select to authenticated
  using (user_id = auth.uid() or public.is_group_participant(group_id, auth.uid()));

-- ===== 11_postgrest_profile_fks.sql =====
do $$ begin
  alter table public.group_members add constraint group_members_user_id_profile_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.turns add constraint turns_beneficiary_user_id_fkey
    foreign key (beneficiary_user_id) references public.profiles(id) on delete restrict;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.contributions add constraint contributions_payer_user_id_fkey
    foreign key (payer_user_id) references public.profiles(id) on delete restrict;
exception when duplicate_object then null; end $$;

-- ===== 12_visibility_and_co_organizers.sql =====
do $$ begin create type public.group_visibility as enum ('private', 'public-link', 'directory'); exception when duplicate_object then null; end $$;
alter table public.groups
  add column if not exists visibility public.group_visibility not null default 'private',
  add column if not exists co_organizers text[] not null default '{}';

drop view if exists public.my_groups_overview;
create or replace view public.my_groups_overview with (security_invoker = true) as
select g.id, g.name, g.description, g.contribution_amount, g.frequency,
       g.max_members, g.status, g.visibility, g.created_at,
       (select count(*) from public.group_members gm where gm.group_id = g.id and gm.status = 'active') as members_count,
       exists (select 1 from public.group_members gm where gm.group_id = g.id and gm.user_id = auth.uid() and gm.role = 'organisateur' and gm.status = 'active') as is_organizer,
       (select gm.status from public.group_members gm where gm.group_id = g.id and gm.user_id = auth.uid() limit 1) as my_status,
       (select gm.role from public.group_members gm where gm.group_id = g.id and gm.user_id = auth.uid() limit 1) as my_role,
       (select p.full_name from public.profiles p where p.id = g.created_by) as organizer_name
from public.groups g
where g.created_by = auth.uid() or public.is_group_participant(g.id, auth.uid());
grant select on public.my_groups_overview to authenticated;

-- ===== 13_phase_i_finalisation.sql =====
alter table public.group_members
  add column if not exists preferred_operator text check (preferred_operator in ('orange', 'mtn') or preferred_operator is null),
  add column if not exists applicant_message text check (applicant_message is null or char_length(applicant_message) <= 280);

create or replace function public._generate_invite_code()
returns text language plpgsql volatile as $$
declare alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; raw text := ''; i int;
begin
  for i in 1..8 loop raw := raw || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
  return 'TD-' || substr(raw, 1, 4) || '-' || substr(raw, 5, 4);
end; $$;

create or replace function public.create_group_with_invitation(_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid(); v_group_id uuid; v_code text;
  v_requested_code text := nullif(_payload->>'invite_code', '');
  v_visibility public.group_visibility := coalesce((_payload->>'visibility')::public.group_visibility, 'private');
  v_rotation public.rotation_order := coalesce((_payload->>'rotation_order_kind')::public.rotation_order, 'random');
  v_frequency public.group_frequency := coalesce((_payload->>'frequency')::public.group_frequency, 'mensuelle');
  v_attempts int := 0;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(_payload->>'name', '') = '' then raise exception 'NAME_REQUIRED'; end if;
  if coalesce((_payload->>'contribution_amount')::bigint, 0) <= 0 then raise exception 'INVALID_CONTRIBUTION'; end if;
  if coalesce((_payload->>'max_members')::int, 0) < 2 then raise exception 'INVALID_MAX_MEMBERS'; end if;
  insert into public.groups (name, description, category, contribution_amount, frequency, max_members,
    rotation_order_kind, late_penalty_percent, late_penalty_after_days, status, visibility, co_organizers, created_by)
  values (_payload->>'name', nullif(_payload->>'description', ''), nullif(_payload->>'category', ''),
    (_payload->>'contribution_amount')::bigint, v_frequency, (_payload->>'max_members')::int, v_rotation,
    coalesce((_payload->>'late_penalty_percent')::int, 0), coalesce((_payload->>'late_penalty_after_days')::int, 0),
    'open', v_visibility,
    coalesce(array(select jsonb_array_elements_text(coalesce(_payload->'co_organizers', '[]'::jsonb))), '{}'), v_user)
  returning id into v_group_id;
  v_code := v_requested_code;
  loop
    v_attempts := v_attempts + 1;
    if v_code is null then v_code := public._generate_invite_code(); end if;
    begin
      insert into public.invitations (group_id, code, created_by) values (v_group_id, v_code, v_user);
      exit;
    exception when unique_violation then
      if v_attempts >= 5 then raise exception 'INVITATION_CODE_COLLISION'; end if;
      v_code := null;
    end;
  end loop;
  return jsonb_build_object('group_id', v_group_id, 'invite_code', v_code);
end; $$;
grant execute on function public.create_group_with_invitation(jsonb) to authenticated;

create table if not exists public.join_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists join_attempts_user_time_idx on public.join_attempts(user_id, attempted_at desc);
grant all on public.join_attempts to service_role;
alter table public.join_attempts enable row level security;

drop function if exists public.join_group_with_code(text);
create or replace function public.join_group_with_code(_code text, _operator text default null, _message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_invitation public.invitations%rowtype; v_visibility public.group_visibility;
  v_user uuid := auth.uid(); v_count int; v_max int; v_attempt_count int;
  v_target_status public.member_status; v_target_position int;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select count(*) into v_attempt_count from public.join_attempts
    where user_id = v_user and attempted_at > now() - interval '10 minutes';
  if v_attempt_count >= 10 then raise exception 'RATE_LIMITED'; end if;
  insert into public.join_attempts (user_id) values (v_user);
  if _operator is not null and _operator not in ('orange', 'mtn') then raise exception 'INVALID_OPERATOR'; end if;
  if _message is not null and char_length(_message) > 280 then raise exception 'MESSAGE_TOO_LONG'; end if;
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
  select max_members, visibility into v_max, v_visibility from public.groups where id = v_invitation.group_id;
  select count(*) into v_count from public.group_members where group_id = v_invitation.group_id and status = 'active';
  if v_count >= v_max then raise exception 'GROUP_FULL'; end if;
  if v_visibility = 'private' then
    v_target_status := 'active'; v_target_position := v_count + 1;
  else
    v_target_status := 'pending'; v_target_position := null;
  end if;
  insert into public.group_members (group_id, user_id, role, status, position, preferred_operator, applicant_message)
  values (v_invitation.group_id, v_user, 'membre', v_target_status, v_target_position, _operator, _message)
  on conflict (group_id, user_id) do update set
    status = case when public.group_members.status in ('active', 'pending') then public.group_members.status else excluded.status end,
    preferred_operator = coalesce(excluded.preferred_operator, public.group_members.preferred_operator),
    applicant_message = coalesce(excluded.applicant_message, public.group_members.applicant_message);
  update public.invitations set uses_count = uses_count + 1 where id = v_invitation.id;
  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_invitation.created_by, 'invitation_accepted',
    case when v_target_status = 'pending' then 'Nouvelle candidature' else 'Nouveau membre' end,
    case when v_target_status = 'pending' then 'Une personne candidate à votre groupe via invitation.' else 'Un membre a rejoint votre groupe via invitation.' end,
    v_invitation.group_id);
  return v_invitation.group_id;
end; $$;
grant execute on function public.join_group_with_code(text, text, text) to authenticated;

-- ===== 14_preview_group_by_code.sql =====
create or replace function public.preview_group_by_code(_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_invitation public.invitations%rowtype; v_group public.groups%rowtype; v_count int; v_organizer text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_invitation from public.invitations where code = _code;
  if not found then raise exception 'INVITATION_NOT_FOUND'; end if;
  if v_invitation.status <> 'pending' then raise exception 'INVITATION_INACTIVE'; end if;
  if v_invitation.expires_at is not null and v_invitation.expires_at < now() then raise exception 'INVITATION_EXPIRED'; end if;
  select * into v_group from public.groups where id = v_invitation.group_id;
  select count(*) into v_count from public.group_members where group_id = v_group.id and status = 'active';
  select coalesce(p.full_name, 'Organisateur') into v_organizer from public.profiles p where p.id = v_group.created_by;
  return jsonb_build_object('name', v_group.name, 'description', v_group.description, 'category', v_group.category,
    'contribution_amount', v_group.contribution_amount, 'frequency', v_group.frequency,
    'max_members', v_group.max_members, 'members_count', v_count, 'visibility', v_group.visibility, 'organizer_name', v_organizer);
end; $$;
grant execute on function public.preview_group_by_code(text) to authenticated;

-- ===== 15_fix_start_cycle_enum_cast.sql =====
create or replace function public.start_cycle(_group_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_group public.groups%rowtype; v_count int; v_cycle_id uuid;
        v_cycle_number int; v_freq_days int; v_payout bigint; v_due date; r record;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_group from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if not public.is_group_organizer(_group_id, v_user) then raise exception 'FORBIDDEN'; end if;
  if v_group.status not in ('draft','open') then raise exception 'CYCLE_ALREADY_STARTED'; end if;
  select count(*) into v_count from public.group_members where group_id = _group_id and status = 'active';
  if v_count < 2 then raise exception 'QUORUM_NOT_REACHED'; end if;
  if v_group.rotation_order_kind = 'random' then
    with shuffled as (select id, row_number() over (order by random()) as rn from public.group_members where group_id = _group_id and status = 'active')
    update public.group_members gm set position = s.rn from shuffled s where gm.id = s.id;
  else
    with ordered as (select id, row_number() over (order by position nulls last, joined_at) as rn from public.group_members where group_id = _group_id and status = 'active')
    update public.group_members gm set position = o.rn from ordered o where gm.id = o.id;
  end if;
  select coalesce(max(cycle_number), 0) + 1 into v_cycle_number from public.cycles where group_id = _group_id;
  insert into public.cycles (group_id, cycle_number, started_at) values (_group_id, v_cycle_number, now()) returning id into v_cycle_id;
  v_freq_days := case v_group.frequency when 'hebdomadaire' then 7 when 'quinzaine' then 14 when 'mensuelle' then 30 end;
  v_payout := v_group.contribution_amount * v_count;
  v_due := current_date + v_freq_days;
  for r in select user_id, position from public.group_members where group_id = _group_id and status = 'active' order by position loop
    insert into public.turns (cycle_id, group_id, beneficiary_user_id, turn_number, due_date, payout_amount, status)
    values (v_cycle_id, _group_id, r.user_id, r.position, v_due, v_payout,
            (case when r.position = 1 then 'collecting' else 'upcoming' end)::public.turn_status);
    insert into public.contributions (turn_id, group_id, payer_user_id, amount, status)
    select (select id from public.turns where cycle_id = v_cycle_id and turn_number = r.position),
           _group_id, gm.user_id, v_group.contribution_amount, 'pending'::public.contribution_status
    from public.group_members gm where gm.group_id = _group_id and gm.status = 'active' and gm.user_id <> r.user_id;
    v_due := v_due + v_freq_days;
  end loop;
  update public.groups set status = 'active' where id = _group_id;
  insert into public.notifications (user_id, kind, title, body, group_id)
  select gm.user_id, 'cycle_started', 'Cycle démarré', 'L''ordre de rotation a été tiré. Premier tour planifié.', _group_id
  from public.group_members gm where gm.group_id = _group_id and gm.status = 'active';
  return v_cycle_id;
end; $$;
grant execute on function public.start_cycle(uuid) to authenticated;

-- ===== 16_update_group_settings.sql =====
create or replace function public.update_group_settings(_group_id uuid, _payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_status public.group_status;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_group_organizer(_group_id, v_user) then raise exception 'FORBIDDEN'; end if;
  select status into v_status from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if v_status not in ('draft', 'open') then raise exception 'CYCLE_ALREADY_STARTED'; end if;
  if _payload ? 'name' and coalesce(_payload->>'name','') = '' then raise exception 'NAME_REQUIRED'; end if;
  if _payload ? 'contribution_amount' and coalesce((_payload->>'contribution_amount')::bigint, 0) <= 0 then raise exception 'INVALID_CONTRIBUTION'; end if;
  if _payload ? 'max_members' and coalesce((_payload->>'max_members')::int, 0) < 2 then raise exception 'INVALID_MAX_MEMBERS'; end if;
  update public.groups set
    name = coalesce(nullif(_payload->>'name',''), name),
    description = case when _payload ? 'description' then nullif(_payload->>'description','') else description end,
    category = case when _payload ? 'category' then nullif(_payload->>'category','') else category end,
    contribution_amount = coalesce((_payload->>'contribution_amount')::bigint, contribution_amount),
    frequency = coalesce((_payload->>'frequency')::public.group_frequency, frequency),
    max_members = coalesce((_payload->>'max_members')::int, max_members),
    rotation_order_kind = coalesce((_payload->>'rotation_order_kind')::public.rotation_order, rotation_order_kind),
    late_penalty_percent = coalesce((_payload->>'late_penalty_percent')::int, late_penalty_percent),
    late_penalty_after_days = coalesce((_payload->>'late_penalty_after_days')::int, late_penalty_after_days),
    visibility = coalesce((_payload->>'visibility')::public.group_visibility, visibility),
    updated_at = now()
  where id = _group_id;
end; $$;
grant execute on function public.update_group_settings(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
