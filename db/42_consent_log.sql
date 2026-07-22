-- =====================================================================
-- Phase D3 — Consentement versionné (CGU)
-- Idempotent.
-- =====================================================================

create extension if not exists pgcrypto;

create table if not exists public.app_terms_versions (
  version text primary key,
  content text not null,
  published_at timestamptz not null default now()
);

grant select on public.app_terms_versions to anon, authenticated;
grant all on public.app_terms_versions to service_role;

alter table public.app_terms_versions enable row level security;
drop policy if exists "terms_select_all" on public.app_terms_versions;
create policy "terms_select_all" on public.app_terms_versions
  for select using (true);

insert into public.app_terms_versions (version, content) values
  ('v1.0', 'Conditions générales d''utilisation Tontine Digital v1.0')
  on conflict (version) do nothing;

create table if not exists public.group_consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  ip_hash text
);

create index if not exists group_consent_log_user_group_idx
  on public.group_consent_log(user_id, group_id);
create index if not exists group_consent_log_group_idx
  on public.group_consent_log(group_id);

grant select, insert on public.group_consent_log to authenticated;
grant all on public.group_consent_log to service_role;

alter table public.group_consent_log enable row level security;

drop policy if exists "consent_select_self_or_org" on public.group_consent_log;
create policy "consent_select_self_or_org" on public.group_consent_log
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_group_organizer(group_id, auth.uid())
  );

drop policy if exists "consent_insert_self" on public.group_consent_log;
create policy "consent_insert_self" on public.group_consent_log
  for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Patch join_group_with_code : consentement obligatoire
-- ---------------------------------------------------------------------
drop function if exists public.join_group_with_code(text, text, text);
create or replace function public.join_group_with_code(
  _code text,
  _operator text default null,
  _message text default null,
  _accepted_terms_version text default null
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
  v_ip_hash text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  if _accepted_terms_version is null or _accepted_terms_version = '' then
    raise exception 'TERMS_REQUIRED';
  end if;
  if not exists (
    select 1 from public.app_terms_versions where version = _accepted_terms_version
  ) then
    raise exception 'TERMS_VERSION_UNKNOWN';
  end if;

  select count(*) into v_attempt_count
    from public.join_attempts
    where user_id = v_user and attempted_at > now() - interval '10 minutes';
  if v_attempt_count >= 10 then raise exception 'RATE_LIMITED'; end if;
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

  -- Trace consentement (hash IP best-effort)
  begin
    v_ip_hash := encode(
      digest(coalesce(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), 'sha256'),
      'hex'
    );
  exception when others then v_ip_hash := null; end;

  insert into public.group_consent_log (user_id, group_id, terms_version, ip_hash)
  values (v_user, v_invitation.group_id, _accepted_terms_version, v_ip_hash);

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

grant execute on function public.join_group_with_code(text, text, text, text) to authenticated;