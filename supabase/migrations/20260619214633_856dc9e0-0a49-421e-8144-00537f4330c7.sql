-- Fenêtre d'édition d'un groupe
create or replace function public.group_edit_window(_group_id uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_status public.group_status;
  v_has_open_cycle boolean;
  v_has_any_cycle boolean;
begin
  select status into v_status from public.groups where id = _group_id;
  if not found then return 'locked'; end if;

  if v_status in ('completed','cancelled') then return 'locked'; end if;
  if v_status in ('draft','open') then return 'pre_cycle'; end if;

  select exists(select 1 from public.cycles where group_id = _group_id and ended_at is null),
         exists(select 1 from public.cycles where group_id = _group_id)
    into v_has_open_cycle, v_has_any_cycle;

  if v_has_open_cycle then return 'in_cycle'; end if;
  if v_has_any_cycle then return 'between_cycles'; end if;
  return 'pre_cycle';
end; $$;

grant execute on function public.group_edit_window(uuid) to authenticated;

-- Refonte de update_group_settings
create or replace function public.update_group_settings(
  _group_id uuid,
  _payload  jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_window text;
  v_old record;
  v_active_members int;
  v_new_freq public.group_frequency;
  v_new_late int;
  v_new_max int;
  v_structural_changed boolean := false;
  v_sensitive_changed boolean := false;
  v_diff jsonb := '{}'::jsonb;
  r_member record;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_group_organizer(_group_id, v_user) then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_old from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;

  v_window := public.group_edit_window(_group_id);
  if v_window = 'locked' then raise exception 'GROUP_LOCKED'; end if;

  -- Validations communes
  if _payload ? 'name' and coalesce(_payload->>'name','') = '' then
    raise exception 'NAME_REQUIRED';
  end if;
  if _payload ? 'contribution_amount'
     and coalesce((_payload->>'contribution_amount')::bigint, 0) < 1000 then
    raise exception 'INVALID_CONTRIBUTION';
  end if;
  if _payload ? 'max_members' then
    v_new_max := (_payload->>'max_members')::int;
    if v_new_max < 2 or v_new_max > 50 then
      raise exception 'INVALID_MAX_MEMBERS';
    end if;
    select count(*) into v_active_members
      from public.group_members
     where group_id = _group_id and status = 'active';
    if v_new_max < v_active_members then
      raise exception 'MAX_MEMBERS_TOO_LOW';
    end if;
  end if;

  v_new_freq := coalesce((_payload->>'frequency')::public.group_frequency, v_old.frequency);
  v_new_late := coalesce((_payload->>'late_penalty_after_days')::int, v_old.late_penalty_after_days);
  if v_new_freq = 'quotidienne'::public.group_frequency and v_new_late > 1 then
    raise exception 'INVALID_FREQUENCY_LATE_DAYS';
  end if;

  -- Détection des champs structurants modifiés
  if (_payload ? 'contribution_amount' and (_payload->>'contribution_amount')::bigint is distinct from v_old.contribution_amount)
     or (_payload ? 'frequency' and (_payload->>'frequency')::public.group_frequency is distinct from v_old.frequency)
     or (_payload ? 'max_members' and (_payload->>'max_members')::int is distinct from v_old.max_members)
     or (_payload ? 'rotation_order_kind' and (_payload->>'rotation_order_kind')::public.rotation_order is distinct from v_old.rotation_order_kind)
     or (_payload ? 'late_penalty_percent' and (_payload->>'late_penalty_percent')::int is distinct from v_old.late_penalty_percent)
     or (_payload ? 'late_penalty_after_days' and (_payload->>'late_penalty_after_days')::int is distinct from v_old.late_penalty_after_days)
  then
    v_structural_changed := true;
  end if;

  if (_payload ? 'contribution_amount' and (_payload->>'contribution_amount')::bigint is distinct from v_old.contribution_amount)
     or (_payload ? 'frequency' and (_payload->>'frequency')::public.group_frequency is distinct from v_old.frequency)
     or (_payload ? 'rotation_order_kind' and (_payload->>'rotation_order_kind')::public.rotation_order is distinct from v_old.rotation_order_kind)
  then
    v_sensitive_changed := true;
  end if;

  if v_window = 'in_cycle' and v_structural_changed then
    raise exception 'STRUCTURAL_CHANGE_FORBIDDEN';
  end if;

  -- Construction du diff pour audit
  v_diff := jsonb_build_object(
    'window', v_window,
    'before', jsonb_build_object(
      'name', v_old.name,
      'description', v_old.description,
      'category', v_old.category,
      'visibility', v_old.visibility,
      'contribution_amount', v_old.contribution_amount,
      'frequency', v_old.frequency,
      'max_members', v_old.max_members,
      'rotation_order_kind', v_old.rotation_order_kind,
      'late_penalty_percent', v_old.late_penalty_percent,
      'late_penalty_after_days', v_old.late_penalty_after_days
    ),
    'patch', _payload
  );

  -- Application
  if v_window = 'in_cycle' then
    update public.groups set
      name = coalesce(nullif(_payload->>'name',''), name),
      description = case when _payload ? 'description' then nullif(_payload->>'description','') else description end,
      category = case when _payload ? 'category' then nullif(_payload->>'category','') else category end,
      visibility = coalesce((_payload->>'visibility')::public.group_visibility, visibility),
      updated_at = now()
    where id = _group_id;
  else
    update public.groups set
      name = coalesce(nullif(_payload->>'name',''), name),
      description = case when _payload ? 'description' then nullif(_payload->>'description','') else description end,
      category = case when _payload ? 'category' then nullif(_payload->>'category','') else category end,
      contribution_amount = coalesce((_payload->>'contribution_amount')::bigint, contribution_amount),
      frequency = coalesce((_payload->>'frequency')::public.group_frequency, frequency),
      max_members = coalesce((_payload->>'max_members')::int, max_members),
      rotation_order_kind = coalesce((_payload->>'rotation_order_kind')::public.rotation_order, rotation_order_kind),
      late_penalty_percent = coalesce((_payload->>'late_penalty_percent')::int, late_penalty_percent),
      late_penalty_after_days = coalesce((_payload->>'late_penalty_after_days')::int, late_penalty_after_days),
      visibility = coalesce((_payload->>'visibility')::public.group_visibility, visibility),
      updated_at = now()
    where id = _group_id;
  end if;

  -- Audit
  perform public.log_audit(_group_id, 'update_group_settings', 'group', _group_id, v_diff);

  -- Consentement sur changements sensibles entre cycles
  if v_sensitive_changed and v_window = 'between_cycles' then
    insert into public.group_consent_log (group_id, user_id, consent_kind, payload)
    values (_group_id, v_user, 'settings_change', v_diff);
  end if;

  -- Notifications aux membres actifs (hors organisateur) si changement structurel
  if v_structural_changed and v_window in ('between_cycles','pre_cycle') then
    for r_member in
      select user_id from public.group_members
       where group_id = _group_id and status = 'active' and user_id <> v_user
    loop
      insert into public.notifications (user_id, kind, title, body, group_id)
      values (
        r_member.user_id,
        'system',
        'Paramètres du groupe mis à jour',
        'L''organisateur a modifié la configuration du groupe « ' || v_old.name || ' ». Consultez les nouveaux paramètres avant le prochain cycle.',
        _group_id
      );
    end loop;
  end if;
end; $$;

grant execute on function public.update_group_settings(uuid, jsonb) to authenticated;