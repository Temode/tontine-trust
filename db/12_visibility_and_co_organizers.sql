-- =====================================================================
-- Phase H — Persistance visibility & co_organizers
-- À exécuter dans le SQL Editor de Supabase. Idempotent.
-- =====================================================================

-- 1. Enum de visibilité (private / public-link / directory)
do $$ begin
  create type public.group_visibility as enum ('private', 'public-link', 'directory');
exception when duplicate_object then null; end $$;

-- 2. Colonnes sur groups (idempotent)
alter table public.groups
  add column if not exists visibility public.group_visibility not null default 'private',
  add column if not exists co_organizers text[] not null default '{}';

-- 3. Vue agrégée enrichie (visibility + my_status + my_role)
-- DROP requis : on insère `visibility` avant `created_at`, ce que
-- CREATE OR REPLACE VIEW refuse (changement d'ordre/nom de colonnes).
drop view if exists public.my_groups_overview;
create or replace view public.my_groups_overview
with (security_invoker = true) as
select
  g.id, g.name, g.description, g.contribution_amount, g.frequency,
  g.max_members, g.status, g.visibility, g.created_at,
  (select count(*) from public.group_members gm
    where gm.group_id = g.id and gm.status = 'active') as members_count,
  exists (select 1 from public.group_members gm
    where gm.group_id = g.id and gm.user_id = auth.uid()
      and gm.role = 'organisateur' and gm.status = 'active') as is_organizer,
  (select gm.status from public.group_members gm
    where gm.group_id = g.id and gm.user_id = auth.uid()
    limit 1) as my_status,
  (select gm.role from public.group_members gm
    where gm.group_id = g.id and gm.user_id = auth.uid()
    limit 1) as my_role,
  (select p.full_name from public.profiles p where p.id = g.created_by) as organizer_name
from public.groups g
where g.created_by = auth.uid()
   or public.is_group_participant(g.id, auth.uid());

grant select on public.my_groups_overview to authenticated;

-- =====================================================================
-- Fin Phase H
-- =====================================================================