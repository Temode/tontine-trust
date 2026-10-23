
-- =====================================================================
-- Phase intégrité tontine : alertes, audit assignations, RPC explain
-- =====================================================================

-- 1) Table d'alertes intégrité ----------------------------------------
create table if not exists public.tontine_alerts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  turn_id uuid references public.turns(id) on delete cascade,
  contribution_id uuid references public.contributions(id) on delete cascade,
  severity text not null check (severity in ('info','warning','critical')),
  code text not null,
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);
create index if not exists tontine_alerts_group_idx
  on public.tontine_alerts(group_id, resolved_at);
create index if not exists tontine_alerts_code_idx
  on public.tontine_alerts(code);

grant select, update on public.tontine_alerts to authenticated;
grant all on public.tontine_alerts to service_role;

alter table public.tontine_alerts enable row level security;

drop policy if exists tontine_alerts_select on public.tontine_alerts;
create policy tontine_alerts_select on public.tontine_alerts
  for select to authenticated
  using (
    public.is_super_admin(auth.uid())
    or public.is_group_organizer(group_id, auth.uid())
  );

drop policy if exists tontine_alerts_update on public.tontine_alerts;
create policy tontine_alerts_update on public.tontine_alerts
  for update to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

-- 2) Trigger : valide chaque cotisation -------------------------------
create or replace function public.trg_validate_contribution_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_turn public.turns%rowtype;
  v_is_member boolean;
  v_is_beneficiary boolean;
  v_code text;
  v_msg text;
begin
  select * into v_turn from public.turns where id = new.turn_id;
  if not found then return new; end if;

  -- Règle 1 : payeur doit être membre actif du groupe
  select exists(
    select 1 from public.group_members
    where group_id = v_turn.group_id and user_id = new.payer_user_id and status = 'active'
  ) into v_is_member;

  if not v_is_member then
    v_code := 'PAYER_NOT_ACTIVE_MEMBER';
    v_msg := 'Cotisation attribuée à un utilisateur qui n''est pas membre actif du groupe.';
    insert into public.tontine_alerts(group_id, turn_id, contribution_id, severity, code, message, metadata)
    values (v_turn.group_id, v_turn.id, new.id, 'critical', v_code, v_msg,
      jsonb_build_object('payer_user_id', new.payer_user_id, 'turn_number', v_turn.turn_number));
  end if;

  -- Règle 2 : payeur ne doit pas être le bénéficiaire de son propre tour
  v_is_beneficiary := (new.payer_user_id = v_turn.beneficiary_user_id);
  if v_is_beneficiary then
    v_code := 'PAYER_IS_BENEFICIARY';
    v_msg := 'Cotisation attribuée au bénéficiaire de ce tour (incohérent : un bénéficiaire ne cotise pas pour lui-même).';
    insert into public.tontine_alerts(group_id, turn_id, contribution_id, severity, code, message, metadata)
    values (v_turn.group_id, v_turn.id, new.id, 'critical', v_code, v_msg,
      jsonb_build_object('payer_user_id', new.payer_user_id,
                         'beneficiary_user_id', v_turn.beneficiary_user_id,
                         'turn_number', v_turn.turn_number));
  end if;

  -- Règle 3 : tour ne doit pas être 'paid' au moment de la création d'une cotisation
  if tg_op = 'INSERT' and v_turn.status = 'paid' then
    insert into public.tontine_alerts(group_id, turn_id, contribution_id, severity, code, message, metadata)
    values (v_turn.group_id, v_turn.id, new.id, 'warning', 'CONTRIBUTION_ON_PAID_TURN',
      'Cotisation créée sur un tour déjà versé.',
      jsonb_build_object('turn_number', v_turn.turn_number));
  end if;

  return new;
end; $$;

drop trigger if exists contributions_validate_assignment on public.contributions;
create trigger contributions_validate_assignment
  after insert or update of payer_user_id, turn_id on public.contributions
  for each row execute function public.trg_validate_contribution_assignment();

-- 3) Trigger : alerte si plusieurs tours ouverts dans un cycle --------
create or replace function public.trg_validate_single_open_turn()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_open_count int;
begin
  if new.status = 'collecting' and (tg_op = 'INSERT' or old.status is distinct from 'collecting') then
    select count(*) into v_open_count
      from public.turns
      where cycle_id = new.cycle_id and status = 'collecting';
    if v_open_count > 1 then
      insert into public.tontine_alerts(group_id, turn_id, severity, code, message, metadata)
      values (new.group_id, new.id, 'critical', 'MULTIPLE_OPEN_TURNS',
        'Plusieurs tours sont ouverts simultanément dans le même cycle.',
        jsonb_build_object('cycle_id', new.cycle_id, 'open_count', v_open_count, 'turn_number', new.turn_number));
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists turns_validate_single_open on public.turns;
create trigger turns_validate_single_open
  after insert or update of status on public.turns
  for each row execute function public.trg_validate_single_open_turn();

-- 4) RPC : explain_contribution -- pourquoi ce membre paie ce tour ---
create or replace function public.explain_contribution(_contribution_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_c public.contributions%rowtype;
  v_t public.turns%rowtype;
  v_g public.groups%rowtype;
  v_payer_name text;
  v_benef_name text;
  v_is_member boolean;
  v_position int;
  v_role text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_c from public.contributions where id = _contribution_id;
  if not found then raise exception 'CONTRIBUTION_NOT_FOUND'; end if;
  if not (public.is_super_admin(v_uid) or public.is_group_organizer(v_c.group_id, v_uid)) then
    raise exception 'FORBIDDEN';
  end if;
  select * into v_t from public.turns where id = v_c.turn_id;
  select * into v_g from public.groups where id = v_c.group_id;
  select full_name into v_payer_name from public.profiles where id = v_c.payer_user_id;
  select full_name into v_benef_name from public.profiles where id = v_t.beneficiary_user_id;
  select status = 'active', position, role::text
    into v_is_member, v_position, v_role
    from public.group_members
    where group_id = v_c.group_id and user_id = v_c.payer_user_id;

  return jsonb_build_object(
    'contribution', jsonb_build_object(
       'id', v_c.id, 'amount', v_c.amount, 'status', v_c.status,
       'created_at', v_c.created_at, 'confirmed_at', v_c.confirmed_at),
    'payer', jsonb_build_object(
       'user_id', v_c.payer_user_id, 'full_name', v_payer_name,
       'is_active_member', coalesce(v_is_member, false),
       'position', v_position, 'role', v_role),
    'turn', jsonb_build_object(
       'id', v_t.id, 'number', v_t.turn_number, 'status', v_t.status,
       'due_date', v_t.due_date, 'payout_amount', v_t.payout_amount),
    'beneficiary', jsonb_build_object(
       'user_id', v_t.beneficiary_user_id, 'full_name', v_benef_name),
    'group', jsonb_build_object(
       'id', v_g.id, 'name', v_g.name, 'frequency', v_g.frequency,
       'contribution_amount', v_g.contribution_amount, 'status', v_g.status),
    'rules_applied', jsonb_build_array(
      jsonb_build_object('rule','PAYER_IS_ACTIVE_MEMBER',
        'pass', coalesce(v_is_member, false),
        'detail','Le payeur doit être membre actif du groupe.'),
      jsonb_build_object('rule','PAYER_NOT_BENEFICIARY',
        'pass', v_c.payer_user_id <> v_t.beneficiary_user_id,
        'detail','Le bénéficiaire du tour ne cotise pas pour lui-même.'),
      jsonb_build_object('rule','TURN_OPEN_OR_PLANNED',
        'pass', v_t.status in ('collecting','upcoming'),
        'detail','Une cotisation ne doit pas être créée sur un tour déjà versé.'),
      jsonb_build_object('rule','DUE_DATE_FUTURE_OR_TODAY',
        'pass', v_t.due_date >= current_date - 30,
        'detail','La date d''échéance du tour doit être cohérente (≤ 30 jours dans le passé).')
    ),
    'explanation', format(
      '%s cotise %s GNF pour le tour #%s de %s, dont le bénéficiaire est %s. ' ||
      'Tour actuellement %s, échéance le %s. Position du payeur dans la rotation : %s.',
      coalesce(v_payer_name, 'Ce membre'), v_c.amount, v_t.turn_number,
      v_g.name, coalesce(v_benef_name, 'inconnu'),
      v_t.status, v_t.due_date, coalesce(v_position::text, 'n/a'))
  );
end; $$;

grant execute on function public.explain_contribution(uuid) to authenticated;

-- 5) Vue d'audit : historique des tours, bénéficiaires, payeurs ------
create or replace view public.turn_assignment_audit
with (security_invoker = true) as
select
  t.group_id,
  g.name as group_name,
  t.cycle_id,
  cy.cycle_number,
  t.id as turn_id,
  t.turn_number,
  t.status as turn_status,
  t.due_date,
  t.paid_at,
  t.beneficiary_user_id,
  pb.full_name as beneficiary_name,
  c.id as contribution_id,
  c.payer_user_id,
  pp.full_name as payer_name,
  c.amount,
  c.status as contribution_status,
  c.confirmed_at,
  (c.payer_user_id = t.beneficiary_user_id) as flag_payer_is_beneficiary,
  not exists(
    select 1 from public.group_members gm
    where gm.group_id = t.group_id and gm.user_id = c.payer_user_id and gm.status='active'
  ) as flag_payer_not_active
from public.turns t
join public.groups g on g.id = t.group_id
join public.cycles cy on cy.id = t.cycle_id
left join public.profiles pb on pb.id = t.beneficiary_user_id
left join public.contributions c on c.turn_id = t.id
left join public.profiles pp on pp.id = c.payer_user_id;

grant select on public.turn_assignment_audit to authenticated;

-- 6) Vue : invariant cycle (utilisée par tests + UI alertes) ---------
create or replace view public.cycle_open_turn_check
with (security_invoker = true) as
select
  cy.id as cycle_id,
  cy.group_id,
  cy.cycle_number,
  count(*) filter (where t.status='collecting') as open_turns,
  count(*) filter (where t.status='upcoming') as upcoming_turns,
  count(*) filter (where t.status='paid') as paid_turns
from public.cycles cy
left join public.turns t on t.cycle_id = cy.id
group by cy.id, cy.group_id, cy.cycle_number;

grant select on public.cycle_open_turn_check to authenticated;

-- 7) RPC : résoudre une alerte ---------------------------------------
create or replace function public.resolve_tontine_alert(_alert_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_super_admin(v_uid) then raise exception 'FORBIDDEN'; end if;
  update public.tontine_alerts
    set resolved_at = now(), resolved_by = v_uid
    where id = _alert_id and resolved_at is null;
end; $$;
grant execute on function public.resolve_tontine_alert(uuid) to authenticated;
