create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) > 0 and length(body) <= 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists group_messages_group_created_idx
  on public.group_messages (group_id, created_at desc);

grant select, insert, update on public.group_messages to authenticated;
grant all on public.group_messages to service_role;

alter table public.group_messages enable row level security;

drop policy if exists "chat_select_members" on public.group_messages;
create policy "chat_select_members" on public.group_messages
  for select to authenticated
  using (exists (select 1 from public.group_members gm
    where gm.group_id = group_messages.group_id and gm.user_id = auth.uid() and gm.status = 'active'));

drop policy if exists "chat_insert_members" on public.group_messages;
create policy "chat_insert_members" on public.group_messages
  for insert to authenticated
  with check (author_user_id = auth.uid() and exists (select 1 from public.group_members gm
    where gm.group_id = group_messages.group_id and gm.user_id = auth.uid() and gm.status = 'active'));

drop policy if exists "chat_update_author" on public.group_messages;
create policy "chat_update_author" on public.group_messages
  for update to authenticated using (author_user_id = auth.uid()) with check (author_user_id = auth.uid());

do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    begin execute 'alter publication supabase_realtime add table public.group_messages';
    exception when duplicate_object then null; end;
  end if;
end $$;