-- =====================================================================
-- Tontine Digital — Schéma métier (Phase A)
-- À exécuter dans le SQL Editor de Supabase APRÈS db/init_auth_roles.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type public.group_frequency as enum ('hebdomadaire', 'quinzaine', 'mensuelle');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.group_status as enum ('draft', 'open', 'active', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.rotation_order as enum ('random', 'fixed', 'choice');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_role as enum ('organisateur', 'membre');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_status as enum ('active', 'invited', 'removed', 'left');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.turn_status as enum ('upcoming', 'collecting', 'paid', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contribution_status as enum ('pending', 'submitted', 'confirmed', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_provider as enum ('orange_money', 'mtn_money', 'cash', 'simulation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_kind as enum (
    'invitation_received', 'invitation_accepted',
    'cycle_started', 'contribution_due', 'contribution_received',
    'turn_paid', 'group_completed', 'system'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. TABLES
-- ---------------------------------------------------------------------

-- groups : un groupe de tontine
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  description text,
  category text,
  contribution_amount bigint not null check (contribution_amount > 0),
  frequency public.group_frequency not null default 'mensuelle',
  max_members int not null check (max_members between 2 and 100),
  rotation_order_kind public.rotation_order not null default 'random',
  late_penalty_percent int not null default 0 check (late_penalty_percent between 0 and 100),
  late_penalty_after_days int not null default 0 check (late_penalty_after_days >= 0),
  status public.group_status not null default 'draft',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists groups_created_by_idx on public.groups(created_by);
create index if not exists groups_status_idx on public.groups(status);

-- group_members : appartenance + rôle par groupe
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'membre',
  status public.member_status not null default 'active',
  position int,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members(user_id);
create index if not exists group_members_group_idx on public.group_members(group_id);

-- invitations : codes d'invitation
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  max_uses int,
  uses_count int not null default 0,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invitations_group_idx on public.invitations(group_id);
create index if not exists invitations_code_idx on public.invitations(code);

-- cycles : un cycle complet d'un groupe
create table if not exists public.cycles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  cycle_number int not null default 1,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (group_id, cycle_number)
);

-- turns : un tour d'un cycle (un bénéficiaire par tour)
create table if not exists public.turns (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  beneficiary_user_id uuid not null references auth.users(id) on delete restrict,
  turn_number int not null,
  due_date date not null,
  payout_amount bigint not null,
  status public.turn_status not null default 'upcoming',
  paid_at timestamptz,
  payout_reference text,
  unique (cycle_id, turn_number)
);
create index if not exists turns_group_idx on public.turns(group_id);
create index if not exists turns_beneficiary_idx on public.turns(beneficiary_user_id);

-- contributions : une cotisation attendue d'un membre pour un tour
create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  turn_id uuid not null references public.turns(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  payer_user_id uuid not null references auth.users(id) on delete restrict,
  amount bigint not null check (amount > 0),
  status public.contribution_status not null default 'pending',
  provider public.payment_provider,
  reference text,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (turn_id, payer_user_id)
);
create index if not exists contributions_payer_idx on public.contributions(payer_user_id);
create index if not exists contributions_turn_idx on public.contributions(turn_id);
create index if not exists contributions_group_idx on public.contributions(group_id);

-- notifications : inbox in-app
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.notification_kind not null,
  title text not null,
  body text,
  group_id uuid references public.groups(id) on delete cascade,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, read_at);

-- ---------------------------------------------------------------------
-- 3. TRIGGERS updated_at
-- ---------------------------------------------------------------------
drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. SECURITY DEFINER helpers (anti-récursion RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_group_member(_group uuid, _user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group and user_id = _user and status = 'active'
  );
$$;

create or replace function public.is_group_organizer(_group uuid, _user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group and user_id = _user
      and role = 'organisateur' and status = 'active'
  );
$$;

-- ---------------------------------------------------------------------
-- 5. TRIGGER : créateur de groupe = organisateur automatique
-- ---------------------------------------------------------------------
create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id, role, status, position)
  values (new.id, new.created_by, 'organisateur', 'active', 1)
  on conflict (group_id, user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- ---------------------------------------------------------------------
-- 6. RLS — activation
-- ---------------------------------------------------------------------
alter table public.groups          enable row level security;
alter table public.group_members   enable row level security;
alter table public.invitations     enable row level security;
alter table public.cycles          enable row level security;
alter table public.turns           enable row level security;
alter table public.contributions   enable row level security;
alter table public.notifications   enable row level security;

-- ---------------------------------------------------------------------
-- 7. RLS — POLICIES
-- ---------------------------------------------------------------------

-- groups : un user voit ses groupes (membre ou créateur). Créer = lui-même.
drop policy if exists groups_select_member on public.groups;
create policy groups_select_member on public.groups for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_group_member(id, auth.uid())
  );

drop policy if exists groups_insert_self on public.groups;
create policy groups_insert_self on public.groups for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists groups_update_organizer on public.groups;
create policy groups_update_organizer on public.groups for update to authenticated
  using (public.is_group_organizer(id, auth.uid()))
  with check (public.is_group_organizer(id, auth.uid()));

drop policy if exists groups_delete_organizer on public.groups;
create policy groups_delete_organizer on public.groups for delete to authenticated
  using (public.is_group_organizer(id, auth.uid()));

-- group_members
drop policy if exists gm_select_member on public.group_members;
create policy gm_select_member on public.group_members for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_group_member(group_id, auth.uid())
  );

-- insertion : soit l'organisateur ajoute qqun, soit l'user s'ajoute lui-même
-- (cas join-via-code géré côté serveur via SECURITY DEFINER plus tard).
drop policy if exists gm_insert_self_or_organizer on public.group_members;
create policy gm_insert_self_or_organizer on public.group_members for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.is_group_organizer(group_id, auth.uid())
  );

drop policy if exists gm_update_organizer on public.group_members;
create policy gm_update_organizer on public.group_members for update to authenticated
  using (public.is_group_organizer(group_id, auth.uid()))
  with check (public.is_group_organizer(group_id, auth.uid()));

drop policy if exists gm_delete_self_or_organizer on public.group_members;
create policy gm_delete_self_or_organizer on public.group_members for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_group_organizer(group_id, auth.uid())
  );

-- invitations : visibles aux membres du groupe ; gérées par organisateur
drop policy if exists inv_select_member on public.invitations;
create policy inv_select_member on public.invitations for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

drop policy if exists inv_insert_organizer on public.invitations;
create policy inv_insert_organizer on public.invitations for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_group_organizer(group_id, auth.uid())
  );

drop policy if exists inv_update_organizer on public.invitations;
create policy inv_update_organizer on public.invitations for update to authenticated
  using (public.is_group_organizer(group_id, auth.uid()))
  with check (public.is_group_organizer(group_id, auth.uid()));

-- cycles : lecture par membres ; mutation par organisateur
drop policy if exists cycles_select_member on public.cycles;
create policy cycles_select_member on public.cycles for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

drop policy if exists cycles_insert_organizer on public.cycles;
create policy cycles_insert_organizer on public.cycles for insert to authenticated
  with check (public.is_group_organizer(group_id, auth.uid()));

drop policy if exists cycles_update_organizer on public.cycles;
create policy cycles_update_organizer on public.cycles for update to authenticated
  using (public.is_group_organizer(group_id, auth.uid()))
  with check (public.is_group_organizer(group_id, auth.uid()));

-- turns : lecture par membres ; mutation par organisateur
drop policy if exists turns_select_member on public.turns;
create policy turns_select_member on public.turns for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

drop policy if exists turns_insert_organizer on public.turns;
create policy turns_insert_organizer on public.turns for insert to authenticated
  with check (public.is_group_organizer(group_id, auth.uid()));

drop policy if exists turns_update_organizer on public.turns;
create policy turns_update_organizer on public.turns for update to authenticated
  using (public.is_group_organizer(group_id, auth.uid()))
  with check (public.is_group_organizer(group_id, auth.uid()));

-- contributions : membre voit celles de son groupe ;
-- crée/modifie les siennes ; organisateur confirme.
drop policy if exists contrib_select_member on public.contributions;
create policy contrib_select_member on public.contributions for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

drop policy if exists contrib_insert_self on public.contributions;
create policy contrib_insert_self on public.contributions for insert to authenticated
  with check (
    payer_user_id = auth.uid()
    and public.is_group_member(group_id, auth.uid())
  );

drop policy if exists contrib_update_payer_or_organizer on public.contributions;
create policy contrib_update_payer_or_organizer on public.contributions for update to authenticated
  using (
    payer_user_id = auth.uid()
    or public.is_group_organizer(group_id, auth.uid())
  )
  with check (
    payer_user_id = auth.uid()
    or public.is_group_organizer(group_id, auth.uid())
  );

-- notifications : chacun voit/MAJ les siennes
drop policy if exists notif_select_own on public.notifications;
create policy notif_select_own on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notif_update_own on public.notifications;
create policy notif_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- pas de policy INSERT publique : les notifications sont créées
-- par des fonctions SECURITY DEFINER côté serveur uniquement.

-- ---------------------------------------------------------------------
-- 8. RPC : rejoindre un groupe via code d'invitation (RLS-safe)
-- ---------------------------------------------------------------------
create or replace function public.join_group_with_code(_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_invitation public.invitations%rowtype;
  v_user uuid := auth.uid();
  v_count int;
  v_max int;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
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

  select max_members into v_max from public.groups where id = v_invitation.group_id;
  select count(*) into v_count from public.group_members
    where group_id = v_invitation.group_id and status = 'active';
  if v_count >= v_max then raise exception 'GROUP_FULL'; end if;

  insert into public.group_members (group_id, user_id, role, status, position)
  values (v_invitation.group_id, v_user, 'membre', 'active', v_count + 1)
  on conflict (group_id, user_id) do update set status = 'active';

  update public.invitations
    set uses_count = uses_count + 1
    where id = v_invitation.id;

  insert into public.notifications (user_id, kind, title, body, group_id)
  values (v_invitation.created_by, 'invitation_accepted',
    'Nouveau membre', 'Un membre a rejoint votre groupe via invitation.',
    v_invitation.group_id);

  return v_invitation.group_id;
end; $$;

grant execute on function public.join_group_with_code(text) to authenticated;

-- ---------------------------------------------------------------------
-- 9. Vue agrégée : mes groupes avec compteur de membres
-- ---------------------------------------------------------------------
create or replace view public.my_groups_overview
with (security_invoker = true) as
select
  g.id, g.name, g.description, g.contribution_amount, g.frequency,
  g.max_members, g.status, g.created_at,
  (select count(*) from public.group_members gm
    where gm.group_id = g.id and gm.status = 'active') as members_count,
  exists (select 1 from public.group_members gm
    where gm.group_id = g.id and gm.user_id = auth.uid()
      and gm.role = 'organisateur' and gm.status = 'active') as is_organizer
from public.groups g
where g.created_by = auth.uid()
   or public.is_group_member(g.id, auth.uid());

-- =====================================================================
-- Fin du schéma Phase A
-- =====================================================================