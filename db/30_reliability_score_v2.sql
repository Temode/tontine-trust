-- =====================================================================
-- Tontine Digital — P2.5 (suite) : score de fiabilité v2
--   score = 0.7 * payment_score + 0.3 * social_score (si >=1 avis)
--   sinon score = payment_score (pas de pénalité sans avis)
-- À exécuter APRÈS db/29_member_reviews.sql
-- Idempotent.
-- =====================================================================

-- Ajoute les colonnes d'avis au snapshot fiabilité
alter table public.user_reliability_scores
  add column if not exists avg_rating numeric(4,2) not null default 0,
  add column if not exists reviews_count int not null default 0;

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
  v_payment_score int;
  v_score int;
  v_tier public.reliability_tier;
  v_pay_rate numeric;
  v_on_time_rate numeric;
  v_penalty int;
  v_avg_rating numeric(4,2);
  v_reviews_count int;
  v_social_score numeric;
  v_row public.user_reliability_scores%rowtype;
begin
  if _user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select count(*) into v_total_due
    from public.contributions c
    join public.turns t on t.id = c.turn_id
    where c.payer_user_id = _user_id
      and t.status in ('collecting','paid','upcoming','skipped');

  select count(*) into v_total_paid
    from public.contributions c
    where c.payer_user_id = _user_id
      and c.status = 'confirmed';

  select
    count(*) filter (where c.confirmed_at::date <= t.due_date),
    count(*) filter (where c.confirmed_at::date >  t.due_date),
    coalesce(avg(greatest(0, (c.confirmed_at::date - t.due_date))) filter (where c.status='confirmed'), 0)
  into v_on_time, v_late, v_avg_delay
  from public.contributions c
  join public.turns t on t.id = c.turn_id
  where c.payer_user_id = _user_id
    and c.status = 'confirmed';

  select count(distinct cy.id) into v_cycles
    from public.cycles cy
    join public.turns t on t.cycle_id = cy.id
    join public.contributions c on c.turn_id = t.id
    where c.payer_user_id = _user_id
      and c.status = 'confirmed'
      and cy.ended_at is not null;

  if v_total_due = 0 then
    v_payment_score := 0;
  else
    v_pay_rate := v_total_paid::numeric / nullif(v_total_due, 0);
    v_on_time_rate := case when v_total_paid > 0
      then v_on_time::numeric / v_total_paid else 0 end;
    v_penalty := case
      when v_avg_delay > 7 then 10
      when v_avg_delay > 3 then 5
      else 0 end;
    v_payment_score := greatest(0, least(100,
      round(85 * v_pay_rate + 15 * v_on_time_rate)::int - v_penalty
    ));
  end if;

  -- Volet social
  select coalesce(round(avg(rating)::numeric, 2), 0), coalesce(count(*),0)
    into v_avg_rating, v_reviews_count
  from public.member_reviews where reviewed_user_id = _user_id;

  if v_reviews_count >= 1 then
    v_social_score := v_avg_rating * 20; -- 1..5 → 20..100
    v_score := round(0.7 * v_payment_score + 0.3 * v_social_score)::int;
  else
    v_score := v_payment_score;
  end if;
  v_score := greatest(0, least(100, v_score));

  v_tier := case
    when v_total_paid = 0 and v_reviews_count = 0 then 'nouveau'
    when v_score >= 85 then 'excellent'
    when v_score >= 70 then 'bon'
    when v_score >= 50 then 'moyen'
    else 'risque'
  end;

  insert into public.user_reliability_scores (
    user_id, score, tier, total_due, total_paid, total_on_time, total_late,
    avg_delay_days, cycles_completed, avg_rating, reviews_count, last_computed_at
  ) values (
    _user_id, v_score, v_tier, v_total_due, v_total_paid, v_on_time, v_late,
    v_avg_delay, v_cycles, v_avg_rating, v_reviews_count, now()
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
    avg_rating = excluded.avg_rating,
    reviews_count = excluded.reviews_count,
    last_computed_at = excluded.last_computed_at
  returning * into v_row;

  return v_row;
end; $$;

grant execute on function public.recompute_reliability(uuid) to authenticated;

-- Trigger : recalcule à chaque avis
create or replace function public.trg_recompute_reliability_on_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_reliability(NEW.reviewed_user_id);
  return NEW;
end; $$;

drop trigger if exists member_reviews_recompute_reliability on public.member_reviews;
create trigger member_reviews_recompute_reliability
  after insert on public.member_reviews
  for each row execute function public.trg_recompute_reliability_on_review();

-- Backfill
do $$
declare r record;
begin
  for r in select id as user_id from public.profiles loop
    begin
      perform public.recompute_reliability(r.user_id);
    exception when others then null;
    end;
  end loop;
end $$;

-- Recrée les vues pour exposer avg_rating / reviews_count
drop view if exists public.my_reliability;
create view public.my_reliability
with (security_invoker = true) as
select * from public.user_reliability_scores where user_id = auth.uid();
grant select on public.my_reliability to authenticated;

drop view if exists public.group_reliability;
create view public.group_reliability
with (security_invoker = true) as
select
  gm.group_id,
  gm.user_id,
  p.full_name,
  coalesce(s.score, 0) as score,
  coalesce(s.tier, 'nouveau'::public.reliability_tier) as tier,
  coalesce(s.total_paid, 0) as total_paid,
  coalesce(s.total_late, 0) as total_late,
  coalesce(s.avg_rating, 0) as avg_rating,
  coalesce(s.reviews_count, 0) as reviews_count
from public.group_members gm
left join public.profiles p on p.id = gm.user_id
left join public.user_reliability_scores s on s.user_id = gm.user_id
where gm.status = 'active';
grant select on public.group_reliability to authenticated;