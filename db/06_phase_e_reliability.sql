-- =====================================================================
-- Tontine Digital — Phase E : score de fiabilité
-- À exécuter APRÈS db/05_phase_d_payout.sql
-- Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ENUM tier
-- ---------------------------------------------------------------------
do $$ begin
  create type public.reliability_tier as enum ('nouveau', 'risque', 'moyen', 'bon', 'excellent');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. TABLE user_reliability_scores
-- ---------------------------------------------------------------------
create table if not exists public.user_reliability_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  score int not null default 0 check (score between 0 and 100),
  tier public.reliability_tier not null default 'nouveau',
  total_due int not null default 0,
  total_paid int not null default 0,
  total_on_time int not null default 0,
  total_late int not null default 0,
  avg_delay_days numeric(6,2) not null default 0,
  cycles_completed int not null default 0,
  last_computed_at timestamptz not null default now()
);

alter table public.user_reliability_scores enable row level security;

-- Helper : partage-t-il un groupe actif avec moi ?
create or replace function public.shares_group_with(_other uuid, _me uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = _me and b.user_id = _other
      and a.status = 'active' and b.status = 'active'
  );
$$;

drop policy if exists reliability_select_self_or_peer on public.user_reliability_scores;
create policy reliability_select_self_or_peer on public.user_reliability_scores
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.shares_group_with(user_id, auth.uid())
  );

-- ---------------------------------------------------------------------
-- 3. RPC recompute_reliability
-- ---------------------------------------------------------------------
create or replace function public.recompute_reliability(_user_id uuid default auth.uid())
returns public.user_reliability_scores
language plpgsql security definer set search_path = public as $$
declare
  v_total_due int;
  v_total_paid int;
  v_on_time int;
  v_late int;
  v_avg_delay numeric(6,2);
  v_cycles int;
  v_score int;
  v_tier public.reliability_tier;
  v_pay_rate numeric;
  v_on_time_rate numeric;
  v_penalty int;
  v_row public.user_reliability_scores%rowtype;
begin
  if _user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  -- contributions attendues (issues de cycles démarrés)
  select count(*) into v_total_due
    from public.contributions c
    join public.turns t on t.id = c.turn_id
    where c.payer_user_id = _user_id
      and t.status in ('collecting', 'paid', 'upcoming', 'skipped');

  -- contributions effectivement réglées
  select count(*) into v_total_paid
    from public.contributions c
    where c.payer_user_id = _user_id
      and c.status = 'confirmed';

  -- ponctualité : confirmées AVANT échéance (turn.due_date)
  select
    count(*) filter (where c.confirmed_at::date <= t.due_date),
    count(*) filter (where c.confirmed_at::date >  t.due_date),
    coalesce(avg(greatest(0, (c.confirmed_at::date - t.due_date))) filter (where c.status = 'confirmed'), 0)
  into v_on_time, v_late, v_avg_delay
  from public.contributions c
  join public.turns t on t.id = c.turn_id
  where c.payer_user_id = _user_id
    and c.status = 'confirmed';

  -- cycles complets dont l'user était membre actif (heuristique : cycles ended_at not null d'un groupe où il a >=1 contribution confirmée)
  select count(distinct cy.id) into v_cycles
    from public.cycles cy
    join public.turns t on t.cycle_id = cy.id
    join public.contributions c on c.turn_id = t.id
    where c.payer_user_id = _user_id
      and c.status = 'confirmed'
      and cy.ended_at is not null;

  if v_total_due = 0 then
    v_score := 0;
    v_tier := 'nouveau';
  else
    v_pay_rate := v_total_paid::numeric / nullif(v_total_due, 0);
    v_on_time_rate := case when v_total_paid > 0
      then v_on_time::numeric / v_total_paid else 0 end;
    v_penalty := case
      when v_avg_delay > 7 then 10
      when v_avg_delay > 3 then 5
      else 0 end;
    v_score := greatest(0, least(100,
      round(85 * v_pay_rate + 15 * v_on_time_rate)::int - v_penalty
    ));
    v_tier := case
      when v_total_paid = 0 then 'nouveau'
      when v_score >= 85 then 'excellent'
      when v_score >= 70 then 'bon'
      when v_score >= 50 then 'moyen'
      else 'risque'
    end;
  end if;

  insert into public.user_reliability_scores (
    user_id, score, tier, total_due, total_paid, total_on_time, total_late,
    avg_delay_days, cycles_completed, last_computed_at
  ) values (
    _user_id, v_score, v_tier, v_total_due, v_total_paid, v_on_time, v_late,
    v_avg_delay, v_cycles, now()
  )
  on conflict (user_id) do update set
    score = excluded.score,
    tier = excluded.tier,
    total_due = excluded.total_due,
    total_paid = excluded.total_paid,
    total_on_time = excluded.total_on_time,
    total_late = excluded.total_late,
    avg_delay_days = excluded.avg_delay_days,
    cycles_completed = excluded.cycles_completed,
    last_computed_at = excluded.last_computed_at
  returning * into v_row;

  return v_row;
end; $$;

grant execute on function public.recompute_reliability(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Trigger : recalcule à chaque confirmation de contribution
-- ---------------------------------------------------------------------
create or replace function public.trg_recompute_reliability()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'UPDATE' and NEW.status = 'confirmed' and OLD.status is distinct from 'confirmed')
     or (TG_OP = 'INSERT' and NEW.status = 'confirmed') then
    perform public.recompute_reliability(NEW.payer_user_id);
  end if;
  return NEW;
end; $$;

drop trigger if exists contributions_recompute_reliability on public.contributions;
create trigger contributions_recompute_reliability
  after insert or update on public.contributions
  for each row execute function public.trg_recompute_reliability();

-- ---------------------------------------------------------------------
-- 5. Initialisation : recalcule pour tous les users existants
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select distinct payer_user_id from public.contributions loop
    perform public.recompute_reliability(r.payer_user_id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. VIEW my_reliability (snapshot user courant)
-- ---------------------------------------------------------------------
create or replace view public.my_reliability
with (security_invoker = true) as
select * from public.user_reliability_scores where user_id = auth.uid();

-- ---------------------------------------------------------------------
-- 7. VIEW group_reliability (membres + scores par groupe)
-- ---------------------------------------------------------------------
create or replace view public.group_reliability
with (security_invoker = true) as
select
  gm.group_id,
  gm.user_id,
  p.full_name,
  coalesce(s.score, 0) as score,
  coalesce(s.tier, 'nouveau'::public.reliability_tier) as tier,
  coalesce(s.total_paid, 0) as total_paid,
  coalesce(s.total_late, 0) as total_late
from public.group_members gm
left join public.profiles p on p.id = gm.user_id
left join public.user_reliability_scores s on s.user_id = gm.user_id
where gm.status = 'active';

-- ---------------------------------------------------------------------
-- 8. VIEW my_late_contributions (5 derniers retards)
-- ---------------------------------------------------------------------
create or replace view public.my_late_contributions
with (security_invoker = true) as
select
  c.id as contribution_id,
  c.group_id,
  g.name as group_name,
  t.turn_number,
  t.due_date,
  c.confirmed_at,
  (c.confirmed_at::date - t.due_date) as delay_days,
  c.amount
from public.contributions c
join public.turns t on t.id = c.turn_id
join public.groups g on g.id = c.group_id
where c.payer_user_id = auth.uid()
  and c.status = 'confirmed'
  and c.confirmed_at::date > t.due_date
order by c.confirmed_at desc
limit 5;

-- =====================================================================
-- Fin Phase E
-- =====================================================================