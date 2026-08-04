-- P1.2 — Annonces organisateur
-- Idempotent.

alter type public.notification_kind add value if not exists 'announcement';

create table if not exists public.group_announcements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  body text not null check (length(trim(body)) between 1 and 2000),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists group_announcements_group_created_idx
  on public.group_announcements (group_id, pinned desc, created_at desc);

grant select, insert, update, delete on public.group_announcements to authenticated;
grant all on public.group_announcements to service_role;

alter table public.group_announcements enable row level security;

drop policy if exists "ann_select_members" on public.group_announcements;
create policy "ann_select_members" on public.group_announcements
  for select to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_announcements.group_id
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
  );

drop policy if exists "ann_insert_organizers" on public.group_announcements;
create policy "ann_insert_organizers" on public.group_announcements
  for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and public.is_group_organizer(group_id, auth.uid())
  );

drop policy if exists "ann_update_organizers" on public.group_announcements;
create policy "ann_update_organizers" on public.group_announcements
  for update to authenticated
  using (public.is_group_organizer(group_id, auth.uid()))
  with check (public.is_group_organizer(group_id, auth.uid()));

drop policy if exists "ann_delete_organizers" on public.group_announcements;
create policy "ann_delete_organizers" on public.group_announcements
  for delete to authenticated
  using (public.is_group_organizer(group_id, auth.uid()));

-- Trigger : notifie tous les membres actifs
create or replace function public.fn_announcement_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_group_name text;
begin
  select name into v_group_name from public.groups where id = NEW.group_id;
  insert into public.notifications (user_id, kind, title, body, group_id, link)
  select gm.user_id, 'announcement'::public.notification_kind,
         'Annonce — ' || coalesce(v_group_name, 'groupe'),
         NEW.title,
         NEW.group_id,
         '/groupes/' || NEW.group_id::text
  from public.group_members gm
  where gm.group_id = NEW.group_id
    and gm.status = 'active'
    and gm.user_id <> NEW.author_user_id;
  return NEW;
end; $$;

drop trigger if exists trg_announcement_notify on public.group_announcements;
create trigger trg_announcement_notify
  after insert on public.group_announcements
  for each row execute function public.fn_announcement_notify();
