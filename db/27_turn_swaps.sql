-- =====================================================================
-- Tontine Digital — P2.3 : échanges de tours entre membres
-- À exécuter APRÈS db/26_notification_preferences.sql
-- Idempotent.
-- =====================================================================

-- 1. Enum politique d'échange sur le groupe
do $$ begin
  create type public.swap_policy as enum ('none','with_consent','organizer_only');
exception when duplicate_object then null; end $$;

alter table public.groups
  add column if not exists swap_policy public.swap_policy not null default 'with_consent';

-- 2. Enum statut d'une demande
do $$ begin
  create type public.swap_status as enum ('pending','accepted','rejected','cancelled');
exception when duplicate_object then null; end $$;

-- 3. Notification kinds
do $$ begin
  alter type public.notification_kind add value if not exists 'swap_requested';
  alter type public.notification_kind add value if not exists 'swap_responded';
  alter type public.notification_kind add value if not exists 'swap_executed';
end $$;

-- 4. Préférences notif par défaut pour les nouveaux types
insert into public.notification_preferences (user_id, notif_type, channel, enabled)
select p.id, t.kind, c.channel, true
from public.profiles p
cross join (values ('swap_requested'::public.notification_kind),
                   ('swap_responded'::public.notification_kind),
                   ('swap_executed'::public.notification_kind)) t(kind)
cross join (values ('in_app'::public.notification_channel),
                   ('email'::public.notification_channel)) c(channel)
on conflict (user_id, notif_type, channel) do nothing;

-- 5. Table principale
create table if not exists public.turn_swap_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_turn_id uuid not null references public.turns(id) on delete cascade,
  to_turn_id uuid not null references public.turns(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  status public.swap_status not null default 'pending',
  reason text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  responded_by uuid references auth.users(id) on delete set null,
  check (from_turn_id <> to_turn_id),
  check (from_user_id <> to_user_id)
);

create index if not exists turn_swap_group_status_idx
  on public.turn_swap_requests (group_id, status, created_at desc);
create index if not exists turn_swap_to_user_idx
  on public.turn_swap_requests (to_user_id, status);
create index if not exists turn_swap_from_user_idx
  on public.turn_swap_requests (from_user_id, status);

-- Une seule demande pending par paire de tours
create unique index if not exists turn_swap_unique_pending
  on public.turn_swap_requests (from_turn_id, to_turn_id)
  where status = 'pending';

grant select, insert, update on public.turn_swap_requests to authenticated;
grant all on public.turn_swap_requests to service_role;

alter table public.turn_swap_requests enable row level security;

drop policy if exists "swap_select_group_members" on public.turn_swap_requests;
create policy "swap_select_group_members" on public.turn_swap_requests
  for select to authenticated
  using (
    public.is_group_member(group_id, auth.uid())
    or public.is_group_organizer(group_id, auth.uid())
  );

-- Pas d'insert/update direct côté client : on passe par les RPC security definer.
drop policy if exists "swap_no_direct_write" on public.turn_swap_requests;
create policy "swap_no_direct_write" on public.turn_swap_requests
  for insert to authenticated with check (false);

-- 6. RPC : request_turn_swap
create or replace function public.request_turn_swap(
  _from_turn uuid,
  _to_turn uuid,
  _reason text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_from public.turns%rowtype;
  v_to public.turns%rowtype;
  v_policy public.swap_policy;
  v_is_org boolean;
  v_req_id uuid;
  v_group_name text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_from from public.turns where id = _from_turn;
  if not found then raise exception 'FROM_TURN_NOT_FOUND'; end if;
  select * into v_to from public.turns where id = _to_turn;
  if not found then raise exception 'TO_TURN_NOT_FOUND'; end if;

  if v_from.group_id <> v_to.group_id then
    raise exception 'CROSS_GROUP_SWAP_FORBIDDEN';
  end if;
  if v_from.cycle_id <> v_to.cycle_id then
    raise exception 'CROSS_CYCLE_SWAP_FORBIDDEN';
  end if;
  if v_from.status <> 'upcoming' or v_to.status <> 'upcoming' then
    raise exception 'TURN_NOT_UPCOMING';
  end if;
  if v_from.beneficiary_user_id <> v_user then
    raise exception 'NOT_FROM_BENEFICIARY';
  end if;
  if v_to.beneficiary_user_id = v_user then
    raise exception 'SAME_BENEFICIARY';
  end if;

  select swap_policy into v_policy from public.groups where id = v_from.group_id;
  v_is_org := public.is_group_organizer(v_from.group_id, v_user);

  if v_policy = 'none' then
    raise exception 'SWAPS_DISABLED';
  end if;
  if v_policy = 'organizer_only' and not v_is_org then
    raise exception 'ORGANIZER_ONLY_SWAPS';
  end if;

  insert into public.turn_swap_requests
    (group_id, from_turn_id, to_turn_id, from_user_id, to_user_id, reason)
  values
    (v_from.group_id, _from_turn, _to_turn, v_user, v_to.beneficiary_user_id, _reason)
  returning id into v_req_id;

  select name into v_group_name from public.groups where id = v_from.group_id;

  if public.should_notify(v_to.beneficiary_user_id, 'swap_requested', 'in_app') then
    perform public.notify(
      v_to.beneficiary_user_id,
      'swap_requested',
      'Demande d''échange de tour',
      'Un membre de ' || coalesce(v_group_name,'votre groupe') || ' propose d''échanger son tour avec le vôtre.',
      v_from.group_id, _from_turn, null,
      jsonb_build_object('request_id', v_req_id)
    );
  end if;

  perform public.log_audit(
    v_from.group_id, 'swap.request', 'turn_swap_request', v_req_id,
    jsonb_build_object(
      'from_turn', _from_turn, 'to_turn', _to_turn,
      'from_user', v_user, 'to_user', v_to.beneficiary_user_id
    )
  );

  return v_req_id;
end; $$;

grant execute on function public.request_turn_swap(uuid, uuid, text) to authenticated;

-- 7. RPC : respond_turn_swap
create or replace function public.respond_turn_swap(
  _request_id uuid,
  _accept boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_req public.turn_swap_requests%rowtype;
  v_from public.turns%rowtype;
  v_to public.turns%rowtype;
  v_is_org boolean;
  v_group_name text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_req from public.turn_swap_requests where id = _request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status <> 'pending' then raise exception 'REQUEST_NOT_PENDING'; end if;

  v_is_org := public.is_group_organizer(v_req.group_id, v_user);
  if v_user <> v_req.to_user_id and not v_is_org then
    raise exception 'FORBIDDEN';
  end if;

  if not _accept then
    update public.turn_swap_requests
      set status='rejected', responded_at=now(), responded_by=v_user
      where id = _request_id;

    if public.should_notify(v_req.from_user_id, 'swap_responded', 'in_app') then
      perform public.notify(
        v_req.from_user_id, 'swap_responded',
        'Échange refusé',
        'Votre demande d''échange de tour a été refusée.',
        v_req.group_id, v_req.from_turn_id, null,
        jsonb_build_object('request_id', _request_id, 'accepted', false)
      );
    end if;
    perform public.log_audit(
      v_req.group_id, 'swap.reject', 'turn_swap_request', _request_id, null
    );
    return;
  end if;

  -- Accept : swap atomique des bénéficiaires
  select * into v_from from public.turns where id = v_req.from_turn_id for update;
  select * into v_to from public.turns where id = v_req.to_turn_id for update;

  if v_from.status <> 'upcoming' or v_to.status <> 'upcoming' then
    raise exception 'TURN_NO_LONGER_UPCOMING';
  end if;

  update public.turns set beneficiary_user_id = v_req.to_user_id where id = v_req.from_turn_id;
  update public.turns set beneficiary_user_id = v_req.from_user_id where id = v_req.to_turn_id;

  update public.turn_swap_requests
    set status='accepted', responded_at=now(), responded_by=v_user
    where id = _request_id;

  -- Marque comme rejetées les autres demandes pending impliquant l'un des tours
  update public.turn_swap_requests
    set status='rejected', responded_at=now(), responded_by=v_user
    where status='pending'
      and id <> _request_id
      and (from_turn_id in (v_req.from_turn_id, v_req.to_turn_id)
           or to_turn_id in (v_req.from_turn_id, v_req.to_turn_id));

  select name into v_group_name from public.groups where id = v_req.group_id;

  if public.should_notify(v_req.from_user_id, 'swap_responded', 'in_app') then
    perform public.notify(
      v_req.from_user_id, 'swap_responded',
      'Échange accepté',
      'Votre échange de tour dans ' || coalesce(v_group_name,'votre groupe') || ' a été accepté.',
      v_req.group_id, v_req.from_turn_id, null,
      jsonb_build_object('request_id', _request_id, 'accepted', true)
    );
  end if;
  if public.should_notify(v_req.to_user_id, 'swap_executed', 'in_app') then
    perform public.notify(
      v_req.to_user_id, 'swap_executed',
      'Échange effectué',
      'Votre tour a été échangé avec un autre membre.',
      v_req.group_id, v_req.to_turn_id, null,
      jsonb_build_object('request_id', _request_id)
    );
  end if;

  perform public.log_audit(
    v_req.group_id, 'swap.accept', 'turn_swap_request', _request_id,
    jsonb_build_object('from_turn', v_req.from_turn_id, 'to_turn', v_req.to_turn_id)
  );
end; $$;

grant execute on function public.respond_turn_swap(uuid, boolean) to authenticated;

-- 8. RPC : cancel_turn_swap (demandeur uniquement, tant que pending)
create or replace function public.cancel_turn_swap(_request_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_req public.turn_swap_requests%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_req from public.turn_swap_requests where id = _request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status <> 'pending' then raise exception 'REQUEST_NOT_PENDING'; end if;
  if v_req.from_user_id <> v_user and not public.is_group_organizer(v_req.group_id, v_user) then
    raise exception 'FORBIDDEN';
  end if;

  update public.turn_swap_requests
    set status='cancelled', responded_at=now(), responded_by=v_user
    where id = _request_id;

  perform public.log_audit(
    v_req.group_id, 'swap.cancel', 'turn_swap_request', _request_id, null
  );
end; $$;

grant execute on function public.cancel_turn_swap(uuid) to authenticated;

-- 9. Vue enrichie pour l'UI
create or replace view public.turn_swap_requests_view as
select
  r.id, r.group_id, r.status, r.reason, r.created_at, r.responded_at,
  r.from_user_id, r.to_user_id,
  r.from_turn_id, r.to_turn_id,
  ft.turn_number as from_turn_number, ft.due_date as from_due_date,
  tt.turn_number as to_turn_number, tt.due_date as to_due_date,
  fp.full_name as from_user_name,
  tp.full_name as to_user_name
from public.turn_swap_requests r
join public.turns ft on ft.id = r.from_turn_id
join public.turns tt on tt.id = r.to_turn_id
left join public.profiles fp on fp.id = r.from_user_id
left join public.profiles tp on tp.id = r.to_user_id;

grant select on public.turn_swap_requests_view to authenticated;

-- 10. Étend update_group_settings pour gérer swap_policy
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

  -- swap_policy peut être changé même cycle démarré.
  if v_status not in ('draft', 'open') then
    -- Seul swap_policy reste modifiable
    if _payload ? 'swap_policy' then
      update public.groups
        set swap_policy = (_payload->>'swap_policy')::public.swap_policy,
            updated_at = now()
      where id = _group_id;
    end if;
    if (select count(*) from jsonb_object_keys(_payload) k where k <> 'swap_policy') > 0 then
      raise exception 'CYCLE_ALREADY_STARTED';
    end if;
    return;
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
    swap_policy = coalesce(
      (_payload->>'swap_policy')::public.swap_policy, swap_policy),
    updated_at = now()
  where id = _group_id;
end; $$;

grant execute on function public.update_group_settings(uuid, jsonb) to authenticated;