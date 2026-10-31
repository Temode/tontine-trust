-- =====================================================================
-- Phase I — Finalisation parcours adhésion
--   1. Métadonnées de candidature sur group_members
--   2. RPC create_group_with_invitation (transactionnelle)
--   3. RPC join_group_with_code enrichi (operator, message, visibility)
--   4. Rate-limit léger sur les tentatives de join
-- À exécuter dans le SQL Editor de Supabase. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Métadonnées de candidature (opérateur Mobile Money + message)
-- ---------------------------------------------------------------------
alter table public.group_members
  add column if not exists preferred_operator text
    check (preferred_operator in ('orange', 'mtn') or preferred_operator is null),
  add column if not exists applicant_message text
    check (applicant_message is null or char_length(applicant_message) <= 280);

-- ---------------------------------------------------------------------
-- 2. Helper : génération d'un code unique TD-XXXX-XXXX
-- ---------------------------------------------------------------------
create or replace function public._generate_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  raw text := '';
  i int;
begin
  for i in 1..8 loop
    raw := raw || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return 'TD-' || substr(raw, 1, 4) || '-' || substr(raw, 5, 4);
end; $$;

-- ---------------------------------------------------------------------
-- 3. RPC create_group_with_invitation
--    Crée le groupe + l'organisateur (trigger) + une invitation initiale
--    dans une seule transaction. Retourne {group_id, invite_code}.
-- ---------------------------------------------------------------------
create or replace function public.create_group_with_invitation(_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_code text;
  v_requested_code text := nullif(_payload->>'invite_code', '');
  v_visibility public.group_visibility := coalesce(
    (_payload->>'visibility')::public.group_visibility,
    'private'
  );
  v_rotation public.rotation_order := coalesce(
    (_payload->>'rotation_order_kind')::public.rotation_order,
    'random'
  );
  v_frequency public.group_frequency := coalesce(
    (_payload->>'frequency')::public.group_frequency,
    'mensuelle'
  );
  v_attempts int := 0;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Validations serveur minimales
  if coalesce(_payload->>'name', '') = '' then
    raise exception 'NAME_REQUIRED';
  end if;
  if coalesce((_payload->>'contribution_amount')::bigint, 0) <= 0 then
    raise exception 'INVALID_CONTRIBUTION';
  end if;
  if coalesce((_payload->>'max_members')::int, 0) < 2 then
    raise exception 'INVALID_MAX_MEMBERS';
  end if;

  insert into public.groups (
    name, description, category,
    contribution_amount, frequency, max_members,
    rotation_order_kind, late_penalty_percent, late_penalty_after_days,
    status, visibility, co_organizers, created_by
  ) values (
    _payload->>'name',
    nullif(_payload->>'description', ''),
    nullif(_payload->>'category', ''),
    (_payload->>'contribution_amount')::bigint,
    v_frequency,
    (_payload->>'max_members')::int,
    v_rotation,
    coalesce((_payload->>'late_penalty_percent')::int, 0),
    coalesce((_payload->>'late_penalty_after_days')::int, 0),
    'open',
    v_visibility,
    coalesce(
      array(select jsonb_array_elements_text(coalesce(_payload->'co_organizers', '[]'::jsonb))),
      '{}'
    ),
    v_user
  ) returning id into v_group_id;

  -- Le trigger on_group_created ajoute déjà l'organisateur en membre actif.

  -- Invitation initiale : on essaie le code demandé, puis on retombe sur un
  -- code généré en cas de collision (jusqu'à 5 tentatives).
  v_code := v_requested_code;
  loop
    v_attempts := v_attempts + 1;
    if v_code is null then
      v_code := public._generate_invite_code();
    end if;
    begin
      insert into public.invitations (group_id, code, created_by)
        values (v_group_id, v_code, v_user);
      exit;
    exception when unique_violation then
      if v_attempts >= 5 then
        raise exception 'INVITATION_CODE_COLLISION';
      end if;
      v_code := null; -- regénère au tour suivant
    end;
  end loop;

  return jsonb_build_object('group_id', v_group_id, 'invite_code', v_code);
end; $$;

grant execute on function public.create_group_with_invitation(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Rate-limit léger : table d'attempts
-- ---------------------------------------------------------------------
create table if not exists public.join_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists join_attempts_user_time_idx
  on public.join_attempts(user_id, attempted_at desc);

alter table public.join_attempts enable row level security;
-- Aucune policy : table privée, accessible uniquement via security definer.
grant all on public.join_attempts to service_role;

-- ---------------------------------------------------------------------
-- 5. RPC join_group_with_code (enrichi : operator, message, visibility-aware)
-- ---------------------------------------------------------------------
drop function if exists public.join_group_with_code(text);
create or replace function public.join_group_with_code(
  _code text,
  _operator text default null,
  _message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.invitations%rowtype;
  v_visibility public.group_visibility;
  v_user uuid := auth.uid();
  v_count int;
  v_max int;
  v_attempt_count int;
  v_target_status public.member_status;
  v_target_position int;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Rate-limit : max 10 tentatives sur 10 minutes
  select count(*) into v_attempt_count
    from public.join_attempts
    where user_id = v_user and attempted_at > now() - interval '10 minutes';
  if v_attempt_count >= 10 then
    raise exception 'RATE_LIMITED';
  end if;
  insert into public.join_attempts (user_id) values (v_user);

  if _operator is not null and _operator not in ('orange', 'mtn') then
    raise exception 'INVALID_OPERATOR';
  end if;
  if _message is not null and char_length(_message) > 280 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;

  select * into v_invitation from public.invitations where code = _code;
  if not found then raise exception 'INVITATION_NOT_FOUND'; end if;
  if v_invitation.status <> 'pending' then raise exception 'INVITATION_INACTIVE'; end if;
  if v_invitation.expires_at is not null and v_invitation.expires_at < now() then
    update public.invitations set status = 'expired' where id = v_invitation.id;
    raise exception 'INVITATION_EXPIRED';
  end if;
  if v_invitation.max_uses is not null and v_invitation.uses_count >= v_invitation.max_uses then
    raise exception 'INVITATION_EXHAUSTED';
  end if;

  select max_members, visibility into v_max, v_visibility
    from public.groups where id = v_invitation.group_id;
  select count(*) into v_count from public.group_members
    where group_id = v_invitation.group_id and status = 'active';
  if v_count >= v_max then raise exception 'GROUP_FULL'; end if;

  -- Visibilité 'private' = invitation explicite par l'organisateur :
  -- adhésion immédiate. Sinon, candidature en attente de validation.
  if v_visibility = 'private' then
    v_target_status := 'active';
    v_target_position := v_count + 1;
  else
    v_target_status := 'pending';
    v_target_position := null;
  end if;

  insert into public.group_members (
    group_id, user_id, role, status, position,
    preferred_operator, applicant_message
  ) values (
    v_invitation.group_id, v_user, 'membre',
    v_target_status, v_target_position,
    _operator, _message
  )
  on conflict (group_id, user_id) do update set
    status = case
      when public.group_members.status in ('active', 'pending')
        then public.group_members.status
      else excluded.status
    end,
    preferred_operator = coalesce(excluded.preferred_operator, public.group_members.preferred_operator),
    applicant_message = coalesce(excluded.applicant_message, public.group_members.applicant_message);

  update public.invitations
    set uses_count = uses_count + 1
    where id = v_invitation.id;

  insert into public.notifications (user_id, kind, title, body, group_id)
  values (
    v_invitation.created_by,
    'invitation_accepted',
    case when v_target_status = 'pending' then 'Nouvelle candidature' else 'Nouveau membre' end,
    case when v_target_status = 'pending'
      then 'Une personne candidate à votre groupe via invitation.'
      else 'Un membre a rejoint votre groupe via invitation.' end,
    v_invitation.group_id
  );

  return v_invitation.group_id;
end; $$;

grant execute on function public.join_group_with_code(text, text, text) to authenticated;

-- =====================================================================
-- Fin Phase I
-- =====================================================================