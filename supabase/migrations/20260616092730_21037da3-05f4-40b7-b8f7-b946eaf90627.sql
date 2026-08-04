-- ============ db/20 group_announcements ============
alter type public.notification_kind add value if not exists 'announcement';
create table if not exists public.group_announcements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  body text not null check (length(trim(body)) between 1 and 2000),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists group_announcements_group_created_idx
  on public.group_announcements (group_id, pinned desc, created_at desc);
grant select, insert, update, delete on public.group_announcements to authenticated;
grant all on public.group_announcements to service_role;
alter table public.group_announcements enable row level security;
drop policy if exists "ann_select_members" on public.group_announcements;
create policy "ann_select_members" on public.group_announcements
  for select to authenticated using (
    exists (select 1 from public.group_members gm
            where gm.group_id = group_announcements.group_id
              and gm.user_id = auth.uid() and gm.status = 'active'));
drop policy if exists "ann_insert_organizers" on public.group_announcements;
create policy "ann_insert_organizers" on public.group_announcements
  for insert to authenticated
  with check (author_user_id = auth.uid()
              and public.is_group_organizer(group_id, auth.uid()));
drop policy if exists "ann_update_organizers" on public.group_announcements;
create policy "ann_update_organizers" on public.group_announcements
  for update to authenticated
  using (public.is_group_organizer(group_id, auth.uid()))
  with check (public.is_group_organizer(group_id, auth.uid()));
drop policy if exists "ann_delete_organizers" on public.group_announcements;
create policy "ann_delete_organizers" on public.group_announcements
  for delete to authenticated
  using (public.is_group_organizer(group_id, auth.uid()));
create or replace function public.fn_announcement_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_group_name text;
begin
  select name into v_group_name from public.groups where id = NEW.group_id;
  insert into public.notifications (user_id, kind, title, body, group_id, link)
  select gm.user_id, 'announcement'::public.notification_kind,
         'Annonce — ' || coalesce(v_group_name, 'groupe'),
         NEW.title, NEW.group_id,
         '/groupes/' || NEW.group_id::text
  from public.group_members gm
  where gm.group_id = NEW.group_id and gm.status = 'active'
    and gm.user_id <> NEW.author_user_id;
  return NEW;
end; $$;
drop trigger if exists trg_announcement_notify on public.group_announcements;
create trigger trg_announcement_notify
  after insert on public.group_announcements
  for each row execute function public.fn_announcement_notify();

-- ============ db/41 audit_ttl ============
create extension if not exists pg_cron;
create table if not exists public.audit_log_purge_history (
  id uuid primary key default gen_random_uuid(),
  purged_at timestamptz not null default now(),
  rows_deleted bigint not null
);
grant select on public.audit_log_purge_history to authenticated;
grant all on public.audit_log_purge_history to service_role;
alter table public.audit_log_purge_history enable row level security;
drop policy if exists "audit_purge_select_service" on public.audit_log_purge_history;
create policy "audit_purge_select_service" on public.audit_log_purge_history
  for select to authenticated using (false);
create or replace function public.purge_audit_log()
returns bigint language plpgsql security definer set search_path = public as $$
declare v_deleted bigint;
begin
  with d as (delete from public.audit_log
             where created_at < now() - interval '6 years' returning 1)
  select count(*) into v_deleted from d;
  insert into public.audit_log_purge_history (rows_deleted) values (v_deleted);
  return v_deleted;
end; $$;
revoke execute on function public.purge_audit_log() from public;
grant execute on function public.purge_audit_log() to service_role;
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'audit-ttl-monthly') then
    perform cron.schedule('audit-ttl-monthly', '0 3 1 * *',
      $cron$ select public.purge_audit_log(); $cron$);
  end if;
exception when undefined_table or undefined_function or insufficient_privilege then null;
end$$;

-- ============ db/42 consent_log ============
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
create policy "terms_select_all" on public.app_terms_versions for select using (true);
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
create index if not exists group_consent_log_user_group_idx on public.group_consent_log(user_id, group_id);
create index if not exists group_consent_log_group_idx on public.group_consent_log(group_id);
grant select, insert on public.group_consent_log to authenticated;
grant all on public.group_consent_log to service_role;
alter table public.group_consent_log enable row level security;
drop policy if exists "consent_select_self_or_org" on public.group_consent_log;
create policy "consent_select_self_or_org" on public.group_consent_log
  for select to authenticated using (
    user_id = auth.uid() or public.is_group_organizer(group_id, auth.uid()));
drop policy if exists "consent_insert_self" on public.group_consent_log;
create policy "consent_insert_self" on public.group_consent_log
  for insert to authenticated with check (user_id = auth.uid());

drop function if exists public.join_group_with_code(text, text, text);
create or replace function public.join_group_with_code(
  _code text, _operator text default null,
  _message text default null, _accepted_terms_version text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_invitation public.invitations%rowtype;
  v_visibility public.group_visibility;
  v_user uuid := auth.uid();
  v_count int; v_max int; v_attempt_count int;
  v_target_status public.member_status; v_target_position int;
  v_ip_hash text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if _accepted_terms_version is null or _accepted_terms_version = '' then
    raise exception 'TERMS_REQUIRED'; end if;
  if not exists (select 1 from public.app_terms_versions where version = _accepted_terms_version) then
    raise exception 'TERMS_VERSION_UNKNOWN'; end if;
  select count(*) into v_attempt_count from public.join_attempts
    where user_id = v_user and attempted_at > now() - interval '10 minutes';
  if v_attempt_count >= 10 then raise exception 'RATE_LIMITED'; end if;
  insert into public.join_attempts (user_id) values (v_user);
  if _operator is not null and _operator not in ('orange', 'mtn') then raise exception 'INVALID_OPERATOR'; end if;
  if _message is not null and char_length(_message) > 280 then raise exception 'MESSAGE_TOO_LONG'; end if;
  select * into v_invitation from public.invitations where code = _code;
  if not found then raise exception 'INVITATION_NOT_FOUND'; end if;
  if v_invitation.status <> 'pending' then raise exception 'INVITATION_INACTIVE'; end if;
  if v_invitation.expires_at is not null and v_invitation.expires_at < now() then
    update public.invitations set status = 'expired' where id = v_invitation.id;
    raise exception 'INVITATION_EXPIRED'; end if;
  if v_invitation.max_uses is not null and v_invitation.uses_count >= v_invitation.max_uses then
    raise exception 'INVITATION_EXHAUSTED'; end if;
  select max_members, visibility into v_max, v_visibility from public.groups where id = v_invitation.group_id;
  select count(*) into v_count from public.group_members
    where group_id = v_invitation.group_id and status = 'active';
  if v_count >= v_max then raise exception 'GROUP_FULL'; end if;
  if v_visibility = 'private' then
    v_target_status := 'active'; v_target_position := v_count + 1;
  else v_target_status := 'pending'; v_target_position := null; end if;
  insert into public.group_members (group_id, user_id, role, status, position, preferred_operator, applicant_message)
  values (v_invitation.group_id, v_user, 'membre', v_target_status, v_target_position, _operator, _message)
  on conflict (group_id, user_id) do update set
    status = case when public.group_members.status in ('active', 'pending')
                  then public.group_members.status else excluded.status end,
    preferred_operator = coalesce(excluded.preferred_operator, public.group_members.preferred_operator),
    applicant_message = coalesce(excluded.applicant_message, public.group_members.applicant_message);
  update public.invitations set uses_count = uses_count + 1 where id = v_invitation.id;
  begin
    v_ip_hash := encode(digest(coalesce(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), 'sha256'), 'hex');
  exception when others then v_ip_hash := null; end;
  insert into public.group_consent_log (user_id, group_id, terms_version, ip_hash)
  values (v_user, v_invitation.group_id, _accepted_terms_version, v_ip_hash);
  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_invitation.created_by, 'invitation_accepted',
    case when v_target_status = 'pending' then 'Nouvelle candidature' else 'Nouveau membre' end,
    case when v_target_status = 'pending'
      then 'Une personne candidate à votre groupe via invitation.'
      else 'Un membre a rejoint votre groupe via invitation.' end,
    v_invitation.group_id);
  return v_invitation.group_id;
end; $$;
grant execute on function public.join_group_with_code(text, text, text, text) to authenticated;

-- ============ db/43 phone privacy ============
alter table public.profiles
  add column if not exists phone_visible_in_groups boolean not null default false;
create or replace function public.mask_phone(_phone text)
returns text language sql immutable as $$
  select case
    when _phone is null then null
    when char_length(_phone) <= 6 then '••••••'
    else substring(_phone from 1 for 4) || '••••••' || right(_phone, 2)
  end
$$;
grant execute on function public.mask_phone(text) to anon, authenticated, service_role;
create or replace function public.update_phone_visibility(_visible boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.profiles set phone_visible_in_groups = _visible where id = v_uid;
  perform public.log_audit(null, 'phone_visibility_changed', 'profile', v_uid,
    jsonb_build_object('visible', _visible));
end; $$;
grant execute on function public.update_phone_visibility(boolean) to authenticated;
create or replace view public.group_members_safe_view
with (security_invoker = true) as
select gm.id, gm.group_id, gm.user_id, gm.role, gm.status, gm.position,
  gm.joined_at, gm.suspended_at, gm.suspended_reason,
  gm.can_chat, gm.can_bid, gm.can_swap, gm.can_invite,
  p.full_name,
  case when p.phone_visible_in_groups or auth.uid() = gm.user_id
       or public.is_group_organizer(gm.group_id, auth.uid())
    then p.phone_number else public.mask_phone(p.phone_number) end as phone_number
from public.group_members gm
left join public.profiles p on p.id = gm.user_id;
grant select on public.group_members_safe_view to authenticated;

-- ============ db/44 + 45 fk turns→profiles ============
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'turns_beneficiary_user_id_fkey'
                   and conrelid = 'public.turns'::regclass) then
    alter table public.turns add constraint turns_beneficiary_user_id_fkey
      foreign key (beneficiary_user_id) references public.profiles(id) on delete restrict;
  end if;
end $$;

-- ============ db/46 djomy_payments ============
do $$ begin
  alter type public.payment_provider add value if not exists 'djomy';
exception when others then null; end $$;

alter table public.payments
  add column if not exists djomy_transaction_id text,
  add column if not exists djomy_link_reference  text,
  add column if not exists payment_method        text,
  add column if not exists redirect_url          text,
  add column if not exists payer_phone           text,
  add column if not exists metadata              jsonb;
create unique index if not exists payments_djomy_tx_uq
  on public.payments(djomy_transaction_id) where djomy_transaction_id is not null;

create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  contribution_id uuid references public.contributions(id) on delete set null,
  purpose text not null check (purpose in ('contribution','service_fee','custom')),
  amount bigint not null check (amount > 0),
  usage_type text not null default 'UNIQUE' check (usage_type in ('UNIQUE','MULTIPLE')),
  djomy_reference text not null,
  djomy_url text not null,
  status text not null default 'active',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb
);
create unique index if not exists payment_links_djomy_ref_uq on public.payment_links(djomy_reference);
create index if not exists payment_links_group_idx on public.payment_links(group_id);
grant select, insert, update, delete on public.payment_links to authenticated;
grant all on public.payment_links to service_role;
alter table public.payment_links enable row level security;
drop policy if exists payment_links_member_select on public.payment_links;
create policy payment_links_member_select on public.payment_links
  for select to authenticated
  using (exists (select 1 from public.group_members gm
                 where gm.group_id = payment_links.group_id
                   and gm.user_id = auth.uid() and gm.status = 'active'));
drop policy if exists payment_links_admin_write on public.payment_links;
create policy payment_links_admin_write on public.payment_links
  for all to authenticated
  using (public.is_group_organizer(payment_links.group_id, auth.uid()))
  with check (public.is_group_organizer(payment_links.group_id, auth.uid()));

create table if not exists public.djomy_webhook_events (
  event_id uuid primary key,
  event_type text not null,
  transaction_id text,
  signature_valid boolean not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
grant all on public.djomy_webhook_events to service_role;
alter table public.djomy_webhook_events enable row level security;

create or replace function public.start_djomy_payment(
  _contribution_id uuid, _method text, _payer_phone text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_contrib public.contributions%rowtype; v_payment_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_contrib from public.contributions where id = _contribution_id;
  if not found then raise exception 'CONTRIBUTION_NOT_FOUND'; end if;
  if v_contrib.payer_user_id <> v_user then raise exception 'FORBIDDEN'; end if;
  if v_contrib.status = 'confirmed' then raise exception 'ALREADY_PAID'; end if;
  insert into public.payments (contribution_id, group_id, user_id, amount, provider,
    status, payment_method, payer_phone, initiated_at)
  values (v_contrib.id, v_contrib.group_id, v_user, v_contrib.amount, 'djomy',
    'initiated', _method, _payer_phone, now())
  returning id into v_payment_id;
  return v_payment_id;
end; $$;
grant execute on function public.start_djomy_payment(uuid, text, text) to authenticated;

create or replace function public.attach_djomy_reference(
  _payment_id uuid, _transaction_id text, _redirect_url text
) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.payments
     set djomy_transaction_id = _transaction_id,
         redirect_url = _redirect_url, status = 'pending'
   where id = _payment_id;
end; $$;
grant execute on function public.attach_djomy_reference(uuid, text, text) to service_role;

create or replace function public.apply_djomy_webhook(
  _payment_id uuid, _new_status text, _provider_ref text,
  _paid_amount bigint, _payment_method text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments%rowtype; v_contrib public.contributions%rowtype;
  v_turn public.turns%rowtype; v_remaining int;
begin
  select * into v_payment from public.payments where id = _payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_payment.status in ('succeeded','refunded') then return; end if;
  update public.payments
     set status = _new_status::public.payment_status,
         provider_ref = coalesce(_provider_ref, provider_ref),
         payment_method = coalesce(_payment_method, payment_method),
         settled_at = case when _new_status in ('succeeded','failed','cancelled')
                           then now() else settled_at end
   where id = _payment_id;
  if _new_status <> 'succeeded' then return; end if;
  select * into v_contrib from public.contributions where id = v_payment.contribution_id;
  if not found or v_contrib.status = 'confirmed' then return; end if;
  select * into v_turn from public.turns where id = v_contrib.turn_id;
  update public.contributions set
    status = 'confirmed', provider = 'djomy',
    reference = coalesce(_provider_ref, v_contrib.reference),
    submitted_at = coalesce(v_contrib.submitted_at, now()),
    confirmed_at = now(), confirmed_by = v_payment.user_id
  where id = v_contrib.id;
  perform public.append_ledger(
    v_contrib.group_id, v_turn.cycle_id, v_turn.id, v_contrib.id, v_payment.id,
    v_payment.user_id, 'contribution_in', v_contrib.amount,
    'Cotisation Djomy tour #' || v_turn.turn_number);
  select count(*) into v_remaining from public.contributions
    where turn_id = v_turn.id and status <> 'confirmed';
  if v_remaining = 0 and v_turn.status <> 'paid' then
    update public.turns set status = ('collecting'::public.turn_status)
      where id = v_turn.id and status <> 'paid';
    insert into public.notifications (user_id, kind, title, body, group_id)
    values (v_turn.beneficiary_user_id, 'contribution_received',
      'Cagnotte complète',
      'Toutes les cotisations de votre tour ont été reçues. Versement à venir.',
      v_turn.group_id);
  end if;
  begin
    perform public.log_audit(v_contrib.group_id, 'djomy_payment_confirmed', 'contribution', v_contrib.id,
      jsonb_build_object('payment_id', v_payment.id, 'amount', _paid_amount,
                         'method', _payment_method, 'provider_ref', _provider_ref));
  exception when others then null; end;
end; $$;
grant execute on function public.apply_djomy_webhook(uuid, text, text, bigint, text) to service_role;

notify pgrst, 'reload schema';