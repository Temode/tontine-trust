-- =====================================================================
-- Phase D4 — Masquage téléphone par défaut
-- Idempotent.
-- =====================================================================

alter table public.profiles
  add column if not exists phone_visible_in_groups boolean not null default false;

-- Helper : masque un numéro (garde 4 premiers + 2 derniers)
create or replace function public.mask_phone(_phone text)
returns text
language sql immutable as $$
  select case
    when _phone is null then null
    when char_length(_phone) <= 6 then '••••••'
    else substring(_phone from 1 for 4) || '••••••' || right(_phone, 2)
  end
$$;
grant execute on function public.mask_phone(text) to anon, authenticated, service_role;

-- RPC : toggle de la visibilité du téléphone
create or replace function public.update_phone_visibility(_visible boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.profiles set phone_visible_in_groups = _visible where id = v_uid;
  perform public.log_audit(
    null, 'phone_visibility_changed', 'profile', v_uid,
    jsonb_build_object('visible', _visible)
  );
end; $$;
grant execute on function public.update_phone_visibility(boolean) to authenticated;

-- Vue : membres d'un groupe avec téléphone masqué par défaut
-- Le téléphone n'est exposé en clair que si :
--   - le membre a opt-in (phone_visible_in_groups = true), OU
--   - le caller est l'utilisateur lui-même, OU
--   - le caller est organisateur du groupe.
create or replace view public.group_members_safe_view
with (security_invoker = true) as
select
  gm.id,
  gm.group_id,
  gm.user_id,
  gm.role,
  gm.status,
  gm.position,
  gm.joined_at,
  gm.suspended_at,
  gm.suspended_reason,
  gm.can_chat,
  gm.can_bid,
  gm.can_swap,
  gm.can_invite,
  p.full_name,
  case
    when p.phone_visible_in_groups
      or auth.uid() = gm.user_id
      or public.is_group_organizer(gm.group_id, auth.uid())
    then p.phone_number
    else public.mask_phone(p.phone_number)
  end as phone_number
from public.group_members gm
left join public.profiles p on p.id = gm.user_id;

grant select on public.group_members_safe_view to authenticated;