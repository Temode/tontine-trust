-- ============ 21_payment_reminders ============
create table if not exists public.reminder_log (
  contribution_id uuid not null references public.contributions(id) on delete cascade,
  sent_on date not null default current_date,
  bucket text not null,
  created_at timestamptz not null default now(),
  primary key (contribution_id, sent_on, bucket)
);
grant select on public.reminder_log to authenticated;
grant all on public.reminder_log to service_role;
alter table public.reminder_log enable row level security;

create or replace function public.enqueue_payment_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare v_inserted int := 0; v_today date := current_date; rec record;
  v_bucket text; v_due date; v_diff int; v_group_name text;
begin
  for rec in
    select c.id as contribution_id, c.payer_user_id, c.turn_id, c.amount,
           t.due_date::date as due_date, t.group_id, t.turn_number
    from public.contributions c join public.turns t on t.id = c.turn_id
    where c.status = 'pending' and t.status in ('upcoming', 'collecting')
  loop
    v_due := rec.due_date; v_diff := v_due - v_today;
    v_bucket := case when v_diff = 2 then 'J-2' when v_diff = 1 then 'J-1'
      when v_diff = 0 then 'J0' when v_diff = -1 then 'J+1'
      when v_diff <= -3 then 'J+3' else null end;
    if v_bucket is null then continue; end if;
    if exists (select 1 from public.reminder_log
      where contribution_id = rec.contribution_id and sent_on = v_today and bucket = v_bucket)
    then continue; end if;
    select name into v_group_name from public.groups where id = rec.group_id;
    insert into public.notifications (user_id, kind, title, body, group_id, turn_id, link)
    values (rec.payer_user_id, 'contribution_due'::public.notification_kind,
      case when v_diff >= 0 then 'Rappel cotisation' else 'Cotisation en retard' end,
      coalesce(v_group_name, 'Groupe') || ' — tour #' || rec.turn_number ||
        case when v_diff > 0 then ' · échéance dans ' || v_diff || ' j'
          when v_diff = 0 then ' · échéance aujourd''hui'
          else ' · ' || abs(v_diff) || ' j de retard' end,
      rec.group_id, rec.turn_id, '/cotisations');
    insert into public.reminder_log (contribution_id, sent_on, bucket)
    values (rec.contribution_id, v_today, v_bucket);
    v_inserted := v_inserted + 1;
  end loop;
  return v_inserted;
end; $$;
grant execute on function public.enqueue_payment_reminders() to service_role;

do $$ declare v_jobid int; begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_jobid from cron.job where jobname = 'tontine_payment_reminders';
    if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
    perform cron.schedule('tontine_payment_reminders', '0 8 * * *',
      $cron$ select public.enqueue_payment_reminders(); $cron$);
  end if;
end $$;

-- ============ 24_audit_log ============
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  group_id uuid references public.groups(id) on delete cascade,
  action text not null, entity_type text, entity_id uuid,
  metadata jsonb, created_at timestamptz not null default now()
);
create index if not exists audit_log_group_created_idx on public.audit_log (group_id, created_at desc);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
drop policy if exists "audit_select_organizers" on public.audit_log;
create policy "audit_select_organizers" on public.audit_log
  for select to authenticated
  using (group_id is not null and public.is_group_organizer(group_id, auth.uid()));

create or replace function public.log_audit(
  _group_id uuid, _action text, _entity_type text default null,
  _entity_id uuid default null, _metadata jsonb default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.audit_log (actor_user_id, group_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), _group_id, _action, _entity_type, _entity_id, _metadata)
  returning id into v_id;
  return v_id;
end; $$;
grant execute on function public.log_audit(uuid, text, text, uuid, jsonb) to authenticated, service_role;

create or replace view public.audit_log_view with (security_invoker = true) as
select a.id, a.group_id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at,
  a.actor_user_id, p.full_name as actor_name
from public.audit_log a left join public.profiles p on p.id = a.actor_user_id;
grant select on public.audit_log_view to authenticated;

-- ============ 25_audit_instrumentation ============
create or replace function public.start_cycle(_group_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_group public.groups%rowtype; v_count int;
  v_cycle_id uuid; v_cycle_number int; v_freq_days int; v_payout bigint; v_due date; r record;
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
  perform public.log_audit(_group_id, 'start_cycle', 'cycle', v_cycle_id,
    jsonb_build_object('members_count', v_count, 'total_turns', v_count, 'payout_amount', v_payout));
  return v_cycle_id;
end; $$;
grant execute on function public.start_cycle(uuid) to authenticated;

create or replace function public.approve_member(_member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_member public.group_members%rowtype;
  v_active int; v_max int; v_next_pos int; v_name text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_member from public.group_members where id = _member_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if not public.is_group_organizer(v_member.group_id, v_user) then raise exception 'FORBIDDEN'; end if;
  if v_member.status::text <> 'pending' then raise exception 'NOT_PENDING'; end if;
  select max_members into v_max from public.groups where id = v_member.group_id;
  select count(*) into v_active from public.group_members where group_id = v_member.group_id and status = 'active';
  if v_active >= v_max then raise exception 'GROUP_FULL'; end if;
  select coalesce(max(position), 0) + 1 into v_next_pos from public.group_members where group_id = v_member.group_id and status = 'active';
  update public.group_members set status = 'active', position = v_next_pos where id = _member_id;
  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_member.user_id, 'invitation_accepted', 'Candidature acceptée',
    'Votre demande d''adhésion au groupe a été acceptée.', v_member.group_id);
  select full_name into v_name from public.profiles where id = v_member.user_id;
  perform public.log_audit(v_member.group_id, 'approve_member', 'group_member', _member_id,
    jsonb_build_object('user_id', v_member.user_id, 'full_name', v_name, 'position', v_next_pos));
end; $$;
grant execute on function public.approve_member(uuid) to authenticated;

create or replace function public.reject_member(_member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_member public.group_members%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_member from public.group_members where id = _member_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if not public.is_group_organizer(v_member.group_id, v_user) then raise exception 'FORBIDDEN'; end if;
  if v_member.status::text <> 'pending' then raise exception 'NOT_PENDING'; end if;
  update public.group_members set status = 'removed' where id = _member_id;
  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_member.user_id, 'system', 'Candidature refusée',
    'Votre demande d''adhésion au groupe a été refusée.', v_member.group_id);
  perform public.log_audit(v_member.group_id, 'reject_member', 'group_member', _member_id,
    jsonb_build_object('user_id', v_member.user_id));
end; $$;
grant execute on function public.reject_member(uuid) to authenticated;

create or replace function public.update_group_settings(_group_id uuid, _payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_status public.group_status;
  v_changed text[] := array[]::text[]; k text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_group_organizer(_group_id, v_user) then raise exception 'FORBIDDEN'; end if;
  select status into v_status from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if v_status not in ('draft', 'open') then raise exception 'CYCLE_ALREADY_STARTED'; end if;
  if _payload ? 'name' and coalesce(_payload->>'name','') = '' then raise exception 'NAME_REQUIRED'; end if;
  if _payload ? 'contribution_amount' and coalesce((_payload->>'contribution_amount')::bigint, 0) <= 0 then raise exception 'INVALID_CONTRIBUTION'; end if;
  if _payload ? 'max_members' and coalesce((_payload->>'max_members')::int, 0) < 2 then raise exception 'INVALID_MAX_MEMBERS'; end if;
  for k in select jsonb_object_keys(_payload) loop v_changed := array_append(v_changed, k); end loop;
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
  perform public.log_audit(_group_id, 'update_group_settings', 'group', _group_id,
    jsonb_build_object('changed_fields', v_changed));
end; $$;
grant execute on function public.update_group_settings(uuid, jsonb) to authenticated;

create or replace function public.record_mock_payment(_contribution_id uuid, _provider public.payment_provider default 'simulation')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_contrib public.contributions%rowtype;
  v_turn public.turns%rowtype; v_group public.groups%rowtype;
  v_payment_id uuid; v_remaining int; v_penalty bigint := 0; v_total bigint;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_contrib from public.contributions where id = _contribution_id;
  if not found then raise exception 'CONTRIBUTION_NOT_FOUND'; end if;
  if v_contrib.payer_user_id <> v_user then raise exception 'FORBIDDEN'; end if;
  if v_contrib.status = 'confirmed' then raise exception 'ALREADY_PAID'; end if;
  select * into v_turn from public.turns where id = v_contrib.turn_id;
  select * into v_group from public.groups where id = v_contrib.group_id;
  if v_group.late_penalty_percent > 0 and (current_date - v_turn.due_date) > v_group.late_penalty_after_days then
    v_penalty := (v_contrib.amount * v_group.late_penalty_percent) / 100;
  end if;
  v_total := v_contrib.amount + v_penalty;
  insert into public.payments (contribution_id, group_id, user_id, amount, provider, provider_ref, status, initiated_at, settled_at)
  values (v_contrib.id, v_contrib.group_id, v_user, v_total, _provider,
    'MOCK-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), 'succeeded', now(), now())
  returning id into v_payment_id;
  update public.contributions set status = 'confirmed', provider = _provider,
    reference = (select provider_ref from public.payments where id = v_payment_id),
    penalty_amount = v_penalty, submitted_at = now(), confirmed_at = now(), confirmed_by = v_user
  where id = v_contrib.id;
  perform public.append_ledger(v_contrib.group_id, v_turn.cycle_id, v_turn.id, v_contrib.id, v_payment_id,
    v_user, 'contribution_in', v_contrib.amount, 'Cotisation tour #' || v_turn.turn_number);
  if v_penalty > 0 then
    perform public.append_ledger(v_contrib.group_id, v_turn.cycle_id, v_turn.id, v_contrib.id, v_payment_id,
      v_user, 'penalty', v_penalty, 'Pénalité de retard (' || v_group.late_penalty_percent || '%)');
  end if;
  select count(*) into v_remaining from public.contributions where turn_id = v_turn.id and status <> 'confirmed';
  if v_remaining = 0 and v_turn.status <> 'paid' then
    update public.turns set status = ('collecting'::public.turn_status) where id = v_turn.id and status <> 'paid';
    insert into public.notifications (user_id, kind, title, body, group_id)
    values (v_turn.beneficiary_user_id, 'contribution_received', 'Cagnotte complète',
      'Toutes les cotisations de votre tour ont été reçues. Versement à venir.', v_turn.group_id);
  end if;
  perform public.log_audit(v_contrib.group_id, 'record_payment', 'contribution', v_contrib.id,
    jsonb_build_object('amount', v_contrib.amount, 'penalty_amount', v_penalty, 'total', v_total,
      'provider', _provider::text, 'turn_id', v_turn.id, 'payment_id', v_payment_id));
  return v_payment_id;
end; $$;
grant execute on function public.record_mock_payment(uuid, public.payment_provider) to authenticated;

create or replace function public.release_payout(_turn_id uuid, _provider public.payment_provider default 'simulation')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_turn public.turns%rowtype; v_remaining int;
  v_total_collected bigint; v_fee bigint; v_net bigint; v_payment_id uuid;
  v_receipt_id uuid; v_receipt_number text; v_ledger_id uuid; v_hash text; v_remaining_turns int;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_turn from public.turns where id = _turn_id for update;
  if not found then raise exception 'TURN_NOT_FOUND'; end if;
  if not public.is_group_organizer(v_turn.group_id, v_user) then raise exception 'FORBIDDEN'; end if;
  if v_turn.status = 'paid' then raise exception 'ALREADY_PAID'; end if;
  if v_turn.status <> 'collecting' then raise exception 'TURN_NOT_READY'; end if;
  select count(*) into v_remaining from public.contributions where turn_id = v_turn.id and status <> 'confirmed';
  if v_remaining > 0 then raise exception 'CONTRIBUTIONS_INCOMPLETE'; end if;
  select coalesce(sum(amount), 0) into v_total_collected from public.contributions where turn_id = v_turn.id and status = 'confirmed';
  if v_total_collected <> v_turn.payout_amount then raise exception 'AMOUNT_MISMATCH'; end if;
  v_fee := (v_total_collected * 1) / 100;
  v_net := v_total_collected - v_fee;
  insert into public.payments (contribution_id, group_id, user_id, amount, provider, provider_ref, status, initiated_at, settled_at)
  select c.id, v_turn.group_id, v_turn.beneficiary_user_id, v_net, _provider,
    'PAYOUT-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), 'succeeded', now(), now()
  from public.contributions c where c.turn_id = v_turn.id order by c.confirmed_at desc nulls last limit 1
  returning id into v_payment_id;
  v_ledger_id := public.append_ledger(v_turn.group_id, v_turn.cycle_id, v_turn.id, null, v_payment_id,
    v_turn.beneficiary_user_id, 'payout_out', -v_net, 'Versement tour #' || v_turn.turn_number);
  if v_fee > 0 then
    perform public.append_ledger(v_turn.group_id, v_turn.cycle_id, v_turn.id, null, v_payment_id,
      null, 'fee', -v_fee, 'Commission plateforme (1%)');
  end if;
  v_receipt_number := 'TD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receipts_number_seq')::text, 6, '0');
  v_hash := encode(digest(v_receipt_number || '|' || v_turn.id::text || '|' || v_payment_id::text || '|' || v_net::text || '|' || extract(epoch from now())::text, 'sha256'), 'hex');
  insert into public.receipts (receipt_number, turn_id, group_id, cycle_id, beneficiary_user_id, payment_id, amount, fee_amount, net_amount, provider, ledger_entry_id, hash, issued_by)
  values (v_receipt_number, v_turn.id, v_turn.group_id, v_turn.cycle_id, v_turn.beneficiary_user_id, v_payment_id, v_total_collected, v_fee, v_net, _provider, v_ledger_id, v_hash, v_user)
  returning id into v_receipt_id;
  update public.turns set status = 'paid', paid_at = now() where id = v_turn.id;
  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_turn.beneficiary_user_id, 'payout_released', 'Versement effectué',
    'Vous avez reçu votre cagnotte. Le reçu numérique est disponible.', v_turn.group_id);
  select count(*) into v_remaining_turns from public.turns where cycle_id = v_turn.cycle_id and status <> 'paid';
  if v_remaining_turns = 0 then update public.cycles set ended_at = now() where id = v_turn.cycle_id and ended_at is null; end if;
  perform public.log_audit(v_turn.group_id, 'release_payout', 'turn', v_turn.id,
    jsonb_build_object('receipt_id', v_receipt_id, 'amount', v_total_collected, 'fee', v_fee, 'net', v_net, 'provider', _provider::text));
  return v_receipt_id;
end; $$;
grant execute on function public.release_payout(uuid, public.payment_provider) to authenticated;

-- ============ 26_notification_preferences ============
do $$ begin create type public.notification_channel as enum ('in_app', 'email', 'sms');
exception when duplicate_object then null; end $$;

create table if not exists public.notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  notif_type public.notification_kind not null,
  channel public.notification_channel not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, notif_type, channel)
);
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;
alter table public.notification_preferences enable row level security;
drop policy if exists "own prefs read" on public.notification_preferences;
create policy "own prefs read" on public.notification_preferences
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "own prefs write" on public.notification_preferences;
create policy "own prefs write" on public.notification_preferences
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.seed_notification_preferences(_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare k public.notification_kind; email_default boolean;
begin
  for k in select unnest(enum_range(null::public.notification_kind)) loop
    insert into public.notification_preferences(user_id, notif_type, channel, enabled)
    values (_user_id, k, 'in_app', true) on conflict do nothing;
    email_default := (k <> 'system');
    insert into public.notification_preferences(user_id, notif_type, channel, enabled)
    values (_user_id, k, 'email', email_default) on conflict do nothing;
    insert into public.notification_preferences(user_id, notif_type, channel, enabled)
    values (_user_id, k, 'sms', false) on conflict do nothing;
  end loop;
end; $$;
grant execute on function public.seed_notification_preferences(uuid) to authenticated, service_role;

do $$ declare r record; begin
  for r in select id from auth.users loop perform public.seed_notification_preferences(r.id); end loop;
end $$;

create or replace function public.trg_seed_notification_prefs()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.seed_notification_preferences(NEW.id); return NEW; end; $$;
drop trigger if exists profiles_seed_notif_prefs on public.profiles;
create trigger profiles_seed_notif_prefs after insert on public.profiles
  for each row execute function public.trg_seed_notification_prefs();

create or replace function public.should_notify(_user_id uuid, _type public.notification_kind, _channel public.notification_channel)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.notification_preferences
    where user_id = _user_id and notif_type = _type and channel = _channel),
    case _channel when 'sms' then false else true end);
$$;
grant execute on function public.should_notify(uuid, public.notification_kind, public.notification_channel) to authenticated, service_role;

create or replace function public.update_notification_preferences(_payload jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_item jsonb; v_count int := 0;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if jsonb_typeof(_payload) <> 'array' then raise exception 'payload must be a JSON array'; end if;
  for v_item in select * from jsonb_array_elements(_payload) loop
    insert into public.notification_preferences(user_id, notif_type, channel, enabled, updated_at)
    values (v_uid, (v_item->>'notif_type')::public.notification_kind,
      (v_item->>'channel')::public.notification_channel, (v_item->>'enabled')::boolean, now())
    on conflict (user_id, notif_type, channel) do update set enabled = excluded.enabled, updated_at = now();
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;
grant execute on function public.update_notification_preferences(jsonb) to authenticated;

create or replace function public.notify(_user_id uuid, _kind public.notification_kind, _title text,
  _body text default null, _group_id uuid default null, _turn_id uuid default null,
  _link text default null, _data jsonb default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if _user_id is null then return null; end if;
  if not public.should_notify(_user_id, _kind, 'in_app') then return null; end if;
  insert into public.notifications (user_id, kind, title, body, group_id, turn_id, link, data)
  values (_user_id, _kind, _title, _body, _group_id, _turn_id, _link, _data)
  returning id into v_id;
  return v_id;
end; $$;

notify pgrst, 'reload schema';