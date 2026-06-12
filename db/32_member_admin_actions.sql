-- =====================================================================
-- Phase B1+B2 — Suspension / réactivation / exclusion de membres
-- Prérequis : db/32a_admin_enum_prelude.sql (commit séparé).
-- Toutes les RPC mutant role/status passent par
--   perform set_config('app.via_rpc','1', true);
-- (cf. trigger gm_block_direct_role_status posé en Phase A).
-- Idempotent.
-- =====================================================================

-- 1. Colonnes de traçabilité
alter table public.group_members
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists suspended_by     uuid references public.profiles(id) on delete set null,
  add column if not exists removed_at       timestamptz,
  add column if not exists removed_reason   text,
  add column if not exists removed_by       uuid references public.profiles(id) on delete set null;

-- 2. Préférences notification par défaut pour les nouveaux types
insert into public.notification_preferences (user_id, notif_type, channel, enabled)
select p.id, t.kind, c.channel, true
from public.profiles p
cross join (values
  ('member_suspended'::public.notification_kind),
  ('member_reactivated'::public.notification_kind),
  ('member_kicked'::public.notification_kind),
  ('permissions_changed'::public.notification_kind),
  ('ownership_transferred'::public.notification_kind)) t(kind)
cross join (values ('in_app'::public.notification_channel),
                   ('email'::public.notification_channel)) c(channel)
on conflict (user_id, notif_type, channel) do nothing;

-- 3. RPC : suspend_member ---------------------------------------------
create or replace function public.suspend_member(
  _member_id uuid,
  _reason    text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := auth.uid();
  v_member public.group_members%rowtype;
  v_name   text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_member from public.group_members where id = _member_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;

  if not (
    public.is_group_organizer(v_member.group_id, v_user)
    or public.has_admin_permission(v_member.group_id, v_user, 'can_suspend_member')
  ) then
    raise exception 'FORBIDDEN';
  end if;

  if v_member.user_id = v_user then
    raise exception 'CANNOT_SUSPEND_SELF';
  end if;
  if v_member.role = 'organisateur' then
    -- protège le créateur du groupe
    if exists (select 1 from public.groups
               where id = v_member.group_id and created_by = v_member.user_id) then
      raise exception 'CANNOT_SUSPEND_OWNER';
    end if;
  end if;
  if v_member.status <> 'active' then
    raise exception 'NOT_ACTIVE';
  end if;

  perform set_config('app.via_rpc', '1', true);
  update public.group_members
     set status           = 'suspended',
         suspended_at     = now(),
         suspended_reason = _reason,
         suspended_by     = v_user
   where id = _member_id;

  select full_name into v_name from public.profiles where id = v_member.user_id;

  perform public.notify(
    v_member.user_id, 'member_suspended',
    'Compte suspendu',
    coalesce('Votre participation a été suspendue. Motif : ' || _reason,
             'Votre participation a été suspendue par l''organisateur.'),
    v_member.group_id, null, null,
    jsonb_build_object('reason', _reason)
  );

  perform public.log_audit(
    v_member.group_id, 'member_suspended', 'group_member', _member_id,
    jsonb_build_object('user_id', v_member.user_id, 'full_name', v_name,
                       'reason', _reason)
  );
end; $$;

grant execute on function public.suspend_member(uuid, text) to authenticated;

-- 4. RPC : reactivate_member ------------------------------------------
create or replace function public.reactivate_member(_member_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := auth.uid();
  v_member public.group_members%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_member from public.group_members where id = _member_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;

  if not (
    public.is_group_organizer(v_member.group_id, v_user)
    or public.has_admin_permission(v_member.group_id, v_user, 'can_suspend_member')
  ) then
    raise exception 'FORBIDDEN';
  end if;
  if v_member.status <> 'suspended' then raise exception 'NOT_SUSPENDED'; end if;

  perform set_config('app.via_rpc', '1', true);
  update public.group_members
     set status = 'active',
         suspended_at = null,
         suspended_reason = null,
         suspended_by = null
   where id = _member_id;

  perform public.notify(
    v_member.user_id, 'member_reactivated',
    'Compte réactivé',
    'Vous pouvez de nouveau participer pleinement au groupe.',
    v_member.group_id, null, null, null
  );
  perform public.log_audit(
    v_member.group_id, 'member_reactivated', 'group_member', _member_id,
    jsonb_build_object('user_id', v_member.user_id)
  );
end; $$;

grant execute on function public.reactivate_member(uuid) to authenticated;

-- 5. RPC : kick_member -------------------------------------------------
create or replace function public.kick_member(
  _member_id uuid,
  _reason    text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := auth.uid();
  v_member public.group_members%rowtype;
  v_name   text;
  v_skipped int := 0;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_member from public.group_members where id = _member_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;

  if not (
    public.is_group_organizer(v_member.group_id, v_user)
    or public.has_admin_permission(v_member.group_id, v_user, 'can_kick_member')
  ) then
    raise exception 'FORBIDDEN';
  end if;

  if v_member.user_id = v_user then
    raise exception 'CANNOT_KICK_SELF';
  end if;
  if exists (select 1 from public.groups
             where id = v_member.group_id and created_by = v_member.user_id) then
    raise exception 'CANNOT_KICK_OWNER';
  end if;
  if v_member.status not in ('active','pending','suspended','invited') then
    raise exception 'ALREADY_REMOVED';
  end if;

  perform set_config('app.via_rpc', '1', true);
  update public.group_members
     set status         = 'removed',
         removed_at     = now(),
         removed_reason = _reason,
         removed_by     = v_user,
         position       = null
   where id = _member_id;

  -- Marque comme skipped les tours upcoming du membre exclu.
  update public.turns
     set status = 'skipped'
   where group_id = v_member.group_id
     and beneficiary_user_id = v_member.user_id
     and status = 'upcoming'
  ;
  get diagnostics v_skipped = row_count;

  select full_name into v_name from public.profiles where id = v_member.user_id;

  perform public.notify(
    v_member.user_id, 'member_kicked',
    'Exclusion du groupe',
    coalesce('Vous avez été exclu du groupe. Motif : ' || _reason,
             'Vous avez été exclu du groupe par l''organisateur.'),
    v_member.group_id, null, null,
    jsonb_build_object('reason', _reason)
  );

  perform public.log_audit(
    v_member.group_id, 'member_kicked', 'group_member', _member_id,
    jsonb_build_object('user_id', v_member.user_id, 'full_name', v_name,
                       'reason', _reason, 'turns_skipped', v_skipped)
  );
end; $$;

grant execute on function public.kick_member(uuid, text) to authenticated;

-- 6. Stub has_admin_permission (vraie version dans db/33).
--    Cette stub évite une erreur si db/33 n'est pas encore appliqué :
--    elle renvoie false → seules les organisateurs peuvent suspendre/kicker.
create or replace function public.has_admin_permission(
  _group uuid, _user uuid, _perm text
) returns boolean
language sql stable security definer set search_path = public as $$
  select false
$$;
grant execute on function public.has_admin_permission(uuid, uuid, text) to authenticated, service_role;