-- =====================================================================
-- Phase G.2 — Visibilité pour les membres en attente
--
-- Constat (test bout en bout) : `join_group_with_code` insère le candidat
-- avec status='pending'. La policy `groups_select_member` ne s'appuie que
-- sur `is_group_member` (qui exige status='active'). Conséquence : le
-- nouveau candidat ne voit ni le groupe (page /groupes/:id → "Groupe
-- introuvable") ni sa demande dans Mes groupes (vue `my_groups_overview`).
--
-- Correctif : introduire `is_group_participant` (active OU pending) et
-- l'utiliser pour les lectures (groupes + membres + vue). Les écritures
-- (update / delete / start_cycle / approve_member …) continuent d'exiger
-- le statut `active` via `is_group_member` / `is_group_organizer`.
-- Idempotent — peut être ré-exécuté.
-- =====================================================================

create or replace function public.is_group_participant(_group uuid, _user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group
      and user_id = _user
      and status in ('active','pending')
  );
$$;

grant execute on function public.is_group_participant(uuid, uuid) to authenticated;

-- Lecture des groupes : créateur OU participant (actif ou en attente)
drop policy if exists groups_select_member on public.groups;
create policy groups_select_member on public.groups for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_group_participant(id, auth.uid())
  );

-- Lecture des membres : sa propre ligne OU être participant du groupe
drop policy if exists gm_select_member on public.group_members;
create policy gm_select_member on public.group_members for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_group_participant(group_id, auth.uid())
  );

-- Vue agrégée : inclure les groupes où l'utilisateur est en attente
create or replace view public.my_groups_overview
with (security_invoker = true) as
select
  g.id, g.name, g.description, g.contribution_amount, g.frequency,
  g.max_members, g.status, g.created_at,
  (select count(*) from public.group_members gm
    where gm.group_id = g.id and gm.status = 'active') as members_count,
  exists (select 1 from public.group_members gm
    where gm.group_id = g.id and gm.user_id = auth.uid()
      and gm.role = 'organisateur' and gm.status = 'active') as is_organizer,
  (select gm.status from public.group_members gm
    where gm.group_id = g.id and gm.user_id = auth.uid()
    limit 1) as my_status
from public.groups g
where g.created_by = auth.uid()
   or public.is_group_participant(g.id, auth.uid());

-- =====================================================================
-- Fin Phase G.2
-- =====================================================================