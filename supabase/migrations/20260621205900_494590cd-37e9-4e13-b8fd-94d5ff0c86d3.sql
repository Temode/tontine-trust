
-- ============================================================
-- Chat v2 : lectures serveur, pièces jointes, appels (UI), présence
-- ============================================================

-- 1. group_message_reads ------------------------------------------------
create table if not exists public.group_message_reads (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, group_id)
);

grant select, insert, update, delete on public.group_message_reads to authenticated;
grant all on public.group_message_reads to service_role;

alter table public.group_message_reads enable row level security;

drop policy if exists "reads_select_self" on public.group_message_reads;
create policy "reads_select_self" on public.group_message_reads
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "reads_upsert_self" on public.group_message_reads;
create policy "reads_upsert_self" on public.group_message_reads
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "reads_update_self" on public.group_message_reads;
create policy "reads_update_self" on public.group_message_reads
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.mark_group_read(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'NOT_A_MEMBER';
  end if;
  insert into public.group_message_reads (user_id, group_id, last_read_at, updated_at)
  values (auth.uid(), p_group_id, now(), now())
  on conflict (user_id, group_id) do update
    set last_read_at = excluded.last_read_at,
        updated_at   = now();
end;
$$;

grant execute on function public.mark_group_read(uuid) to authenticated;

-- 2. group_messages : pièces jointes -----------------------------------
alter table public.group_messages
  add column if not exists attachment_url  text,
  add column if not exists attachment_type text,
  add column if not exists attachment_name text,
  add column if not exists attachment_size int;

-- Autoriser un message sans body si pièce jointe présente
alter table public.group_messages drop constraint if exists group_messages_body_check;
alter table public.group_messages
  add constraint group_messages_body_or_attachment_check
  check (
    (body is not null and length(trim(body)) > 0 and length(body) <= 2000)
    or attachment_url is not null
  );

-- 3. call_requests -----------------------------------------------------
do $$ begin
  create type public.call_request_status as enum
    ('pending','accepted','declined','cancelled','missed','ended');
exception when duplicate_object then null;
end $$;

create table if not exists public.call_requests (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups(id) on delete cascade,
  requested_by  uuid not null references public.profiles(id) on delete cascade,
  topic         text,
  scheduled_at  timestamptz,
  status        public.call_request_status not null default 'pending',
  started_at    timestamptz,
  ended_at      timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists call_requests_group_created_idx
  on public.call_requests (group_id, created_at desc);

grant select, insert, update on public.call_requests to authenticated;
grant all on public.call_requests to service_role;

alter table public.call_requests enable row level security;

drop policy if exists "calls_select_members" on public.call_requests;
create policy "calls_select_members" on public.call_requests
  for select to authenticated using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = call_requests.group_id
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
  );

drop policy if exists "calls_insert_members" on public.call_requests;
create policy "calls_insert_members" on public.call_requests
  for insert to authenticated with check (
    requested_by = auth.uid()
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = call_requests.group_id
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
  );

drop policy if exists "calls_update_members" on public.call_requests;
create policy "calls_update_members" on public.call_requests
  for update to authenticated using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = call_requests.group_id
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
  );

create or replace function public.request_group_call(
  p_group_id uuid, p_topic text, p_scheduled_at timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and status = 'active'
  ) then raise exception 'NOT_A_MEMBER'; end if;
  insert into public.call_requests (group_id, requested_by, topic, scheduled_at)
  values (p_group_id, auth.uid(), nullif(trim(coalesce(p_topic,'')), ''), p_scheduled_at)
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.request_group_call(uuid, text, timestamptz) to authenticated;

create or replace function public.respond_call_request(
  p_id uuid, p_status public.call_request_status
) returns void
language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  select group_id into v_group from public.call_requests where id = p_id;
  if v_group is null then raise exception 'NOT_FOUND'; end if;
  if not exists (
    select 1 from public.group_members
    where group_id = v_group and user_id = auth.uid() and status = 'active'
  ) then raise exception 'NOT_A_MEMBER'; end if;
  if p_status not in ('accepted','declined','cancelled','missed','ended') then
    raise exception 'INVALID_STATUS';
  end if;
  update public.call_requests
     set status = p_status,
         updated_at = now(),
         started_at = case when p_status = 'accepted' then now() else started_at end,
         ended_at   = case when p_status in ('ended','cancelled','missed','declined') then now() else ended_at end
   where id = p_id;
end;
$$;
grant execute on function public.respond_call_request(uuid, public.call_request_status) to authenticated;

-- 4. user_call_presence ------------------------------------------------
do $$ begin
  create type public.call_presence_status as enum ('available','busy','dnd');
exception when duplicate_object then null;
end $$;

create table if not exists public.user_call_presence (
  user_id   uuid primary key references public.profiles(id) on delete cascade,
  status    public.call_presence_status not null default 'available',
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.user_call_presence to authenticated;
grant all on public.user_call_presence to service_role;

alter table public.user_call_presence enable row level security;

drop policy if exists "presence_select_co_members" on public.user_call_presence;
create policy "presence_select_co_members" on public.user_call_presence
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.group_members me
      join public.group_members other on other.group_id = me.group_id
      where me.user_id = auth.uid() and me.status = 'active'
        and other.user_id = user_call_presence.user_id and other.status = 'active'
    )
  );

drop policy if exists "presence_upsert_self" on public.user_call_presence;
create policy "presence_upsert_self" on public.user_call_presence
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "presence_update_self" on public.user_call_presence;
create policy "presence_update_self" on public.user_call_presence
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5. Realtime ----------------------------------------------------------
do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    begin execute 'alter publication supabase_realtime add table public.group_message_reads'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.call_requests'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.user_call_presence'; exception when duplicate_object then null; end;
  end if;
end $$;
