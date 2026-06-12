-- =====================================================================
-- Phase B3+B5 — Co-organisateurs granulaires + transfert de propriété
-- Prérequis : db/32_member_admin_actions.sql (helpers + enums).
-- Idempotent.
-- =====================================================================

-- 1. Table de permissions admin granulaires (1 ligne par co-organisateur)
create table if not exists public.group_admin_permissions (
  group_id              uuid not null references public.groups(id) on delete cascade,
  user_id               uuid not null references auth.users(id)    on delete cascade,
  can_approve_members   boolean not null default false,
  can_suspend_member    boolean not null default false,
  can_kick_member       boolean not null default false,
  can_edit_settings     boolean not null default false,
  can_manage_invitations boolean not null default false,
  can_confirm_payments  boolean not null default false,
  can_waive_penalty     boolean not null default false,
  can_send_announcements boolean not null default false,
  can_pause_cycle       boolean not null default false,
  granted_by            uuid references auth.users(id) on delete set null,
  granted_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  primary key (group_id, user_id)
);

grant select, insert, update, delete on public.group_admin_permissions to authenticated;
grant all on public.group_admin_permissions to service_role;

alter table public.group_admin_permissions enable row level security;

-- Helper : propriétaire du groupe (created_by)
create or replace function public.is_group_owner(_group uuid, _user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.groups where id = _group and created_by = _user
  );
$$;
grant execute on function public.is_group_owner(uuid, uuid) to authenticated, service_role;

-- RLS : visible aux membres du groupe (pour afficher les badges),
--       écriture réservée au propriétaire (transfer_ownership inclus).
drop policy if exists "gap_select_members" on public.group_admin_permissions;
create policy "gap_select_members" on public.group_admin_permissions
  for select to authenticated
  using (
    public.is_group_member(group_id, auth.uid())
    or public.is_group_organizer(group_id, auth.uid())
  );

drop policy if exists "gap_no_direct_write" on public.group_admin_permissions;
create policy "gap_no_direct_write" on public.group_admin_permissions
  for insert to authenticated with check (false);

-- 2. has_admin_permission (vraie implémentation, remplace le stub de db/32)
create or replace function public.has_admin_permission(
  _group uuid, _user uuid, _perm text
) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_owner boolean;
  v_ok boolean := false;
begin
  if _user is null then return false; end if;
  -- Le propriétaire a tous les droits.
  select public.is_group_owner(_group, _user) into v_owner;
  if v_owner then return true; end if;

  execute format(
    'select coalesce((select %I from public.group_admin_permissions
                       where group_id = $1 and user_id = $2), false)',
    _perm
  ) into v_ok using _group, _user;
  return coalesce(v_ok, false);
end; $$;
grant execute on function public.has_admin_permission(uuid, uuid, text) to authenticated, service_role;

-- 3. RPC : grant_admin_permissions (owner uniquement) ------------------
create or replace function public.grant_admin_permissions(
  _group_id uuid,
  _user_id  uuid,
  _perms    jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_is_member boolean;
begin
  if v_caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_group_owner(_group_id, v_caller) then
    raise exception 'FORBIDDEN';
  end if;
  if _user_id = v_caller then raise exception 'CANNOT_GRANT_SELF'; end if;

  select exists (select 1 from public.group_members
                  where group_id = _group_id and user_id = _user_id
                    and status = 'active')
    into v_is_member;
  if not v_is_member then raise exception 'NOT_ACTIVE_MEMBER'; end if;

  insert into public.group_admin_permissions as gap
    (group_id, user_id, granted_by,
     can_approve_members, can_suspend_member, can_kick_member,
     can_edit_settings, can_manage_invitations, can_confirm_payments,
     can_waive_penalty, can_send_announcements, can_pause_cycle)
  values (_group_id, _user_id, v_caller,
     coalesce((_perms->>'can_approve_members')::boolean, false),
     coalesce((_perms->>'can_suspend_member')::boolean, false),
     coalesce((_perms->>'can_kick_member')::boolean, false),
     coalesce((_perms->>'can_edit_settings')::boolean, false),
     coalesce((_perms->>'can_manage_invitations')::boolean, false),
     coalesce((_perms->>'can_confirm_payments')::boolean, false),
     coalesce((_perms->>'can_waive_penalty')::boolean, false),
     coalesce((_perms->>'can_send_announcements')::boolean, false),
     coalesce((_perms->>'can_pause_cycle')::boolean, false))
  on conflict (group_id, user_id) do update set
     can_approve_members    = excluded.can_approve_members,
     can_suspend_member     = excluded.can_suspend_member,
     can_kick_member        = excluded.can_kick_member,
     can_edit_settings      = excluded.can_edit_settings,
     can_manage_invitations = excluded.can_manage_invitations,
     can_confirm_payments   = excluded.can_confirm_payments,
     can_waive_penalty      = excluded.can_waive_penalty,
     can_send_announcements = excluded.can_send_announcements,
     can_pause_cycle        = excluded.can_pause_cycle,
     updated_at             = now();

  perform public.notify(
    _user_id, 'permissions_changed',
    'Permissions mises à jour',
    'Vos droits de co-organisateur ont été modifiés.',
    _group_id, null, null, _perms
  );
  perform public.log_audit(
    _group_id, 'permissions_changed', 'group_admin_permissions', null,
    jsonb_build_object('user_id', _user_id, 'perms', _perms)
  );
end; $$;
grant execute on function public.grant_admin_permissions(uuid, uuid, jsonb) to authenticated;

-- 4. RPC : revoke_admin_permissions ------------------------------------
create or replace function public.revoke_admin_permissions(
  _group_id uuid,
  _user_id  uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_group_owner(_group_id, v_caller) then
    raise exception 'FORBIDDEN';
  end if;

  delete from public.group_admin_permissions
   where group_id = _group_id and user_id = _user_id;

  perform public.notify(
    _user_id, 'permissions_changed',
    'Droits de co-organisateur retirés',
    'Vous n''êtes plus co-organisateur de ce groupe.',
    _group_id, null, null, null
  );
  perform public.log_audit(
    _group_id, 'permissions_revoked', 'group_admin_permissions', null,
    jsonb_build_object('user_id', _user_id)
  );
end; $$;
grant execute on function public.revoke_admin_permissions(uuid, uuid) to authenticated;

-- 5. RPC : transfer_ownership (owner uniquement) -----------------------
create or replace function public.transfer_ownership(
  _group_id uuid,
  _new_owner_user_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_old_owner uuid;
  v_old_member_id uuid;
  v_new_member_id uuid;
begin
  if v_caller is null then raise exception 'AUTH_REQUIRED'; end if;
  select created_by into v_old_owner from public.groups where id = _group_id;
  if v_old_owner is null then raise exception 'GROUP_NOT_FOUND'; end if;
  if v_old_owner <> v_caller then raise exception 'FORBIDDEN'; end if;
  if _new_owner_user_id = v_caller then raise exception 'SAME_OWNER'; end if;

  select id into v_new_member_id from public.group_members
    where group_id = _group_id and user_id = _new_owner_user_id and status = 'active';
  if v_new_member_id is null then raise exception 'NEW_OWNER_NOT_ACTIVE_MEMBER'; end if;

  select id into v_old_member_id from public.group_members
    where group_id = _group_id and user_id = v_old_owner and status = 'active';

  perform set_config('app.via_rpc', '1', true);

  -- Promeut le nouveau (rôle organisateur)
  update public.group_members
     set role = 'organisateur'
   where id = v_new_member_id;

  -- L'ancien reste organisateur (rôle), mais le created_by bascule.
  update public.groups
     set created_by = _new_owner_user_id,
         updated_at = now()
   where id = _group_id;

  -- Donne à l'ancien propriétaire toutes les permissions admin par défaut.
  insert into public.group_admin_permissions as gap
    (group_id, user_id, granted_by,
     can_approve_members, can_suspend_member, can_kick_member,
     can_edit_settings, can_manage_invitations, can_confirm_payments,
     can_waive_penalty, can_send_announcements, can_pause_cycle)
  values (_group_id, v_old_owner, _new_owner_user_id,
          true, true, true, true, true, true, true, true, true)
  on conflict (group_id, user_id) do update set
     can_approve_members=true, can_suspend_member=true, can_kick_member=true,
     can_edit_settings=true, can_manage_invitations=true,
     can_confirm_payments=true, can_waive_penalty=true,
     can_send_announcements=true, can_pause_cycle=true,
     updated_at = now();

  -- Le nouveau propriétaire n'a pas besoin de ligne dans admin_permissions
  -- (is_group_owner court-circuite has_admin_permission).
  delete from public.group_admin_permissions
    where group_id = _group_id and user_id = _new_owner_user_id;

  perform public.notify(
    _new_owner_user_id, 'ownership_transferred',
    'Vous êtes le nouveau propriétaire',
    'La propriété du groupe vous a été transférée.',
    _group_id, null, null, null
  );
  perform public.notify(
    v_old_owner, 'ownership_transferred',
    'Propriété transférée',
    'Vous avez transféré la propriété du groupe. Vous restez co-organisateur avec tous les droits.',
    _group_id, null, null, null
  );
  perform public.log_audit(
    _group_id, 'ownership_transferred', 'group', _group_id,
    jsonb_build_object('from', v_old_owner, 'to', _new_owner_user_id)
  );
end; $$;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;

-- 6. Vue pratique pour l'UI : permissions + profil
create or replace view public.group_admin_permissions_view as
select gap.*, p.full_name, p.phone_number
from public.group_admin_permissions gap
left join public.profiles p on p.id = gap.user_id;

grant select on public.group_admin_permissions_view to authenticated;

-- 7. Note : groups.co_organizers (text[] de téléphones) reste pour
--    compatibilité écran existante. Sera retiré en Phase C après
--    migration des données.
comment on column public.groups.co_organizers is
  'DEPRECATED : utiliser public.group_admin_permissions (Phase B3).';