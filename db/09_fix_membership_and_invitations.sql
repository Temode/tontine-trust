-- =====================================================================
-- Phase G — Correctifs flux invitation & adhésion
-- À exécuter dans le SQL Editor de Supabase. Idempotent.
-- =====================================================================

-- 1. S'assurer que la valeur 'pending' existe bien dans member_status
do $$ begin
  alter type public.member_status add value if not exists 'pending';
exception when duplicate_object then null; end $$;

-- 2. (Re)création idempotente du trigger qui ajoute le créateur du groupe
--    comme organisateur actif (member_status='active', role='organisateur').
create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id, role, status, position)
  values (new.id, new.created_by, 'organisateur', 'active', 1)
  on conflict (group_id, user_id) do update
    set role = 'organisateur', status = 'active';
  return new;
end; $$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- 3. Backfill : tout créateur de groupe doit être organisateur actif.
insert into public.group_members (group_id, user_id, role, status, position)
select g.id, g.created_by, 'organisateur', 'active', 1
from public.groups g
where not exists (
  select 1 from public.group_members gm
  where gm.group_id = g.id and gm.user_id = g.created_by
)
on conflict (group_id, user_id) do nothing;

-- Pour les anciens créateurs déjà présents en 'pending'/'left', les réactiver.
update public.group_members gm
set role = 'organisateur', status = 'active',
    position = coalesce(gm.position, 1)
from public.groups g
where gm.group_id = g.id
  and gm.user_id = g.created_by
  and (gm.role <> 'organisateur' or gm.status <> 'active');

-- 4. Sécurité : restreindre la lecture des invitations aux organisateurs
--    (les codes ne doivent pas fuiter aux autres membres ni aux invités).
--    La validation d'un code par un non‑membre passe par la RPC
--    `join_group_with_code` (security definer), pas par un SELECT direct.
drop policy if exists inv_select_member on public.invitations;
drop policy if exists inv_select_organizer on public.invitations;
create policy inv_select_organizer on public.invitations for select to authenticated
  using (public.is_group_organizer(group_id, auth.uid()));

-- =====================================================================
-- Fin Phase G
-- =====================================================================