
-- Trigger de validation centralisé pour les groupes
create or replace function public.validate_group_params()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.contribution_amount is null or new.contribution_amount < 1000 then
    raise exception 'La cotisation doit être d''au moins 1 000 GNF.'
      using errcode = 'check_violation';
  end if;

  if new.max_members is null or new.max_members < 2 or new.max_members > 50 then
    raise exception 'Le nombre de membres doit être compris entre 2 et 50.'
      using errcode = 'check_violation';
  end if;

  if new.frequency = 'quotidienne'::public.group_frequency
     and coalesce(new.late_penalty_after_days, 0) > 1 then
    raise exception 'Pour une fréquence quotidienne, le délai avant pénalité ne peut pas dépasser 1 jour.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_group_params on public.groups;
create trigger trg_validate_group_params
  before insert or update on public.groups
  for each row execute function public.validate_group_params();

-- Mise à jour des messages d'erreur dans update_group_settings
create or replace function public.update_group_settings(
  _group_id uuid,
  _payload  jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_status public.group_status;
  v_freq public.group_frequency;
  v_late_after int;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_group_organizer(_group_id, v_user) then
    raise exception 'FORBIDDEN';
  end if;

  select status, frequency, late_penalty_after_days
    into v_status, v_freq, v_late_after
    from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if v_status not in ('draft', 'open') then
    raise exception 'CYCLE_ALREADY_STARTED';
  end if;

  if _payload ? 'name' and coalesce(_payload->>'name','') = '' then
    raise exception 'Le nom du groupe est requis.';
  end if;
  if _payload ? 'contribution_amount'
     and coalesce((_payload->>'contribution_amount')::bigint, 0) < 1000 then
    raise exception 'La cotisation doit être d''au moins 1 000 GNF.';
  end if;
  if _payload ? 'max_members' then
    if coalesce((_payload->>'max_members')::int, 0) < 2
       or coalesce((_payload->>'max_members')::int, 0) > 50 then
      raise exception 'Le nombre de membres doit être compris entre 2 et 50.';
    end if;
  end if;

  -- Cohérence quotidienne / délai de pénalité
  declare
    v_new_freq public.group_frequency := coalesce(
      (_payload->>'frequency')::public.group_frequency, v_freq);
    v_new_late int := coalesce(
      (_payload->>'late_penalty_after_days')::int, v_late_after);
  begin
    if v_new_freq = 'quotidienne'::public.group_frequency and v_new_late > 1 then
      raise exception 'Pour une fréquence quotidienne, le délai avant pénalité ne peut pas dépasser 1 jour.';
    end if;
  end;

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
