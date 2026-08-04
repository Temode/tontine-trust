-- =====================================================================
-- Tontine Digital — P2.1 : préférences de notification multi-canal
-- Idempotent.
-- =====================================================================

-- ENUM canal
do $$ begin
  create type public.notification_channel as enum ('in_app', 'email', 'sms');
exception when duplicate_object then null; end $$;

-- Table préférences
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

-- Seed defaults : tous in_app=on, tous email=on sauf announcement/system off-by-default
-- (chat est géré par db/19, pas dans cette enum), tous sms=off (Djomy/P3).
create or replace function public.seed_notification_preferences(_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  k public.notification_kind;
  email_default boolean;
begin
  for k in select unnest(enum_range(null::public.notification_kind)) loop
    -- in_app : tout activé
    insert into public.notification_preferences(user_id, notif_type, channel, enabled)
    values (_user_id, k, 'in_app', true)
    on conflict do nothing;
    -- email : activé sauf 'system'
    email_default := (k <> 'system');
    insert into public.notification_preferences(user_id, notif_type, channel, enabled)
    values (_user_id, k, 'email', email_default)
    on conflict do nothing;
    -- sms : tout désactivé par défaut
    insert into public.notification_preferences(user_id, notif_type, channel, enabled)
    values (_user_id, k, 'sms', false)
    on conflict do nothing;
  end loop;
end; $$;

grant execute on function public.seed_notification_preferences(uuid) to authenticated, service_role;

-- Backfill : seed pour tous les profils existants
do $$ declare r record; begin
  for r in select id from auth.users loop
    perform public.seed_notification_preferences(r.id);
  end loop;
end $$;

-- Trigger : seed à la création d'un profil
create or replace function public.trg_seed_notification_prefs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_notification_preferences(NEW.id);
  return NEW;
end; $$;

drop trigger if exists profiles_seed_notif_prefs on public.profiles;
create trigger profiles_seed_notif_prefs
  after insert on public.profiles
  for each row execute function public.trg_seed_notification_prefs();

-- Helper : should_notify(user, type, channel)
create or replace function public.should_notify(
  _user_id uuid,
  _type public.notification_kind,
  _channel public.notification_channel
) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select enabled from public.notification_preferences
      where user_id = _user_id and notif_type = _type and channel = _channel),
    case _channel when 'sms' then false else true end
  );
$$;

grant execute on function public.should_notify(uuid, public.notification_kind, public.notification_channel) to authenticated, service_role;

-- RPC bulk update
create or replace function public.update_notification_preferences(_payload jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_count int := 0;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if jsonb_typeof(_payload) <> 'array' then
    raise exception 'payload must be a JSON array';
  end if;
  for v_item in select * from jsonb_array_elements(_payload) loop
    insert into public.notification_preferences(user_id, notif_type, channel, enabled, updated_at)
    values (
      v_uid,
      (v_item->>'notif_type')::public.notification_kind,
      (v_item->>'channel')::public.notification_channel,
      (v_item->>'enabled')::boolean,
      now()
    )
    on conflict (user_id, notif_type, channel)
    do update set enabled = excluded.enabled, updated_at = now();
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;

grant execute on function public.update_notification_preferences(jsonb) to authenticated;

-- Mise à jour du helper notify() pour respecter les préférences in_app
create or replace function public.notify(
  _user_id uuid,
  _kind public.notification_kind,
  _title text,
  _body text default null,
  _group_id uuid default null,
  _turn_id uuid default null,
  _link text default null,
  _data jsonb default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if _user_id is null then return null; end if;
  if not public.should_notify(_user_id, _kind, 'in_app') then
    return null;
  end if;
  insert into public.notifications (user_id, kind, title, body, group_id, turn_id, link, data)
  values (_user_id, _kind, _title, _body, _group_id, _turn_id, _link, _data)
  returning id into v_id;
  return v_id;
end; $$;