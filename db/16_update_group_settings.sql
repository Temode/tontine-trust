-- =====================================================================
-- P0.1 — RPC update_group_settings
--   Permet à un organisateur de modifier les paramètres d'un groupe
--   tant que le cycle n'est pas démarré (status in 'draft','open').
-- À exécuter dans le SQL Editor. Idempotent.
-- =====================================================================

create or replace function public.update_group_settings(
  _group_id uuid,
  _payload  jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_status public.group_status;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_group_organizer(_group_id, v_user) then
    raise exception 'FORBIDDEN';
  end if;

  select status into v_status from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if v_status not in ('draft', 'open') then
    raise exception 'CYCLE_ALREADY_STARTED';
  end if;

  -- Validations
  if _payload ? 'name' and coalesce(_payload->>'name','') = '' then
    raise exception 'NAME_REQUIRED';
  end if;
  if _payload ? 'contribution_amount'
     and coalesce((_payload->>'contribution_amount')::bigint, 0) <= 0 then
    raise exception 'INVALID_CONTRIBUTION';
  end if;
  if _payload ? 'max_members'
     and coalesce((_payload->>'max_members')::int, 0) < 2 then
    raise exception 'INVALID_MAX_MEMBERS';
  end if;

  update public.groups set
    name = coalesce(nullif(_payload->>'name',''), name),
    description = case
      when _payload ? 'description' then nullif(_payload->>'description','')
      else description end,
    category = case
      when _payload ? 'category' then nullif(_payload->>'category','')
      else category end,
    contribution_amount = coalesce(
      (_payload->>'contribution_amount')::bigint, contribution_amount),
    frequency = coalesce(
      (_payload->>'frequency')::public.group_frequency, frequency),
    max_members = coalesce(
      (_payload->>'max_members')::int, max_members),
    rotation_order_kind = coalesce(
      (_payload->>'rotation_order_kind')::public.rotation_order, rotation_order_kind),
    late_penalty_percent = coalesce(
      (_payload->>'late_penalty_percent')::int, late_penalty_percent),
    late_penalty_after_days = coalesce(
      (_payload->>'late_penalty_after_days')::int, late_penalty_after_days),
    visibility = coalesce(
      (_payload->>'visibility')::public.group_visibility, visibility),
    updated_at = now()
  where id = _group_id;
end; $$;

grant execute on function public.update_group_settings(uuid, jsonb) to authenticated;