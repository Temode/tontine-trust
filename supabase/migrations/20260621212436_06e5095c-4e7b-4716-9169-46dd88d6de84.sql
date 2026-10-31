
-- =========================================================
-- Audio calls v1 : participants + join/leave/mute RPC
-- =========================================================

create table if not exists public.call_participants (
  call_id   uuid not null references public.call_requests(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at   timestamptz,
  is_muted  boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (call_id, user_id)
);

create index if not exists call_participants_call_idx
  on public.call_participants (call_id);

grant select, insert, update, delete on public.call_participants to authenticated;
grant all on public.call_participants to service_role;

alter table public.call_participants enable row level security;

-- Visible aux membres actifs du groupe parent
drop policy if exists "call_participants_select_member" on public.call_participants;
create policy "call_participants_select_member" on public.call_participants
  for select to authenticated
  using (
    exists (
      select 1
      from public.call_requests cr
      join public.group_members gm on gm.group_id = cr.group_id
      where cr.id = call_participants.call_id
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
  );

drop policy if exists "call_participants_insert_self" on public.call_participants;
create policy "call_participants_insert_self" on public.call_participants
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.call_requests cr
      join public.group_members gm on gm.group_id = cr.group_id
      where cr.id = call_participants.call_id
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
  );

drop policy if exists "call_participants_update_self" on public.call_participants;
create policy "call_participants_update_self" on public.call_participants
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Realtime
alter publication supabase_realtime add table public.call_participants;

-- ---------------------------------------------------------
-- RPC : join_call
-- ---------------------------------------------------------
create or replace function public.join_call(p_call_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select group_id into v_group_id from public.call_requests where id = p_call_id;
  if v_group_id is null then
    raise exception 'CALL_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.group_members
    where group_id = v_group_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'NOT_A_MEMBER';
  end if;

  insert into public.call_participants (call_id, user_id, joined_at, left_at, is_muted, updated_at)
  values (p_call_id, auth.uid(), now(), null, false, now())
  on conflict (call_id, user_id) do update
    set joined_at = case when public.call_participants.left_at is not null then now() else public.call_participants.joined_at end,
        left_at   = null,
        is_muted  = false,
        updated_at = now();

  update public.call_requests
     set status = case when status in ('pending') then 'accepted' else status end,
         started_at = coalesce(started_at, now()),
         updated_at = now()
   where id = p_call_id
     and status in ('pending','accepted');

  insert into public.user_call_presence (user_id, status, updated_at)
  values (auth.uid(), 'busy', now())
  on conflict (user_id) do update set status = 'busy', updated_at = now();
end;
$$;

grant execute on function public.join_call(uuid) to authenticated;

-- ---------------------------------------------------------
-- RPC : leave_call
-- ---------------------------------------------------------
create or replace function public.leave_call(p_call_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining int;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.call_participants
     set left_at = now(), updated_at = now()
   where call_id = p_call_id and user_id = auth.uid() and left_at is null;

  select count(*) into v_remaining
    from public.call_participants
   where call_id = p_call_id and left_at is null;

  if v_remaining = 0 then
    update public.call_requests
       set status = 'ended', ended_at = coalesce(ended_at, now()), updated_at = now()
     where id = p_call_id and status in ('pending','accepted');
  end if;

  insert into public.user_call_presence (user_id, status, updated_at)
  values (auth.uid(), 'available', now())
  on conflict (user_id) do update set status = 'available', updated_at = now();
end;
$$;

grant execute on function public.leave_call(uuid) to authenticated;

-- ---------------------------------------------------------
-- RPC : set_call_mute
-- ---------------------------------------------------------
create or replace function public.set_call_mute(p_call_id uuid, p_muted boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  update public.call_participants
     set is_muted = p_muted, updated_at = now()
   where call_id = p_call_id and user_id = auth.uid();
end;
$$;

grant execute on function public.set_call_mute(uuid, boolean) to authenticated;
