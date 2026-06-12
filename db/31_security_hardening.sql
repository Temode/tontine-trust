-- =====================================================================
-- Phase A — Sécurité critique
--   A1. Patch recompute_reliability : guard auth.uid() / organisateur
--   A2. Verrouille group_members.role/status contre UPDATE direct
--       (toute mutation passe désormais par RPC SECURITY DEFINER qui
--        positionne app.via_rpc='1')
--   A3. Helpers réutilisables par les phases B/C/D
-- Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A1. recompute_reliability : guard utilisateur
-- ---------------------------------------------------------------------
create or replace function public.recompute_reliability(_user_id uuid default auth.uid())
returns public.user_reliability_scores
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
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
  if v_caller is null then raise exception 'AUTH_REQUIRED'; end if;
  if _user_id is null then _user_id := v_caller; end if;

  -- Guard : on ne peut recalculer que pour soi-même OU pour un membre
  -- d'un groupe dont on est organisateur.
  if _user_id <> v_caller then
    if not exists (
      select 1
      from public.group_members gm_target
      join public.group_members gm_admin
        on gm_admin.group_id = gm_target.group_id
      where gm_target.user_id = _user_id
        and gm_admin.user_id = v_caller
        and gm_admin.role = 'organisateur'
        and gm_admin.status = 'active'
    ) then
      raise exception 'FORBIDDEN';
    end if;
  end if;

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

  select coalesce(round(avg(rating)::numeric, 2), 0), coalesce(count(*),0)
    into v_avg_rating, v_reviews_count
  from public.member_reviews where reviewed_user_id = _user_id;

  if v_reviews_count >= 1 then
    v_social_score := v_avg_rating * 20;
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

revoke execute on function public.recompute_reliability(uuid) from public;
grant execute on function public.recompute_reliability(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- A2. Helper : flag d'autorisation posé par les RPC SECURITY DEFINER
-- ---------------------------------------------------------------------
-- Les RPC admin doivent appeler perform set_config('app.via_rpc','1', true);
-- juste avant de muter group_members.role ou group_members.status.
create or replace function public.is_rpc_context()
returns boolean
language sql stable as $$
  select coalesce(current_setting('app.via_rpc', true), '0') = '1'
$$;
grant execute on function public.is_rpc_context() to authenticated, service_role;

-- Trigger qui rejette toute modification de role / status hors RPC.
create or replace function public.trg_gm_block_direct_role_status()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if (OLD.role is distinct from NEW.role
        or OLD.status is distinct from NEW.status)
       and not public.is_rpc_context() then
      raise exception 'DIRECT_ROLE_STATUS_UPDATE_FORBIDDEN'
        using hint = 'Use a SECURITY DEFINER RPC (suspend_member, kick_member, etc.)';
    end if;
  end if;
  return NEW;
end; $$;

drop trigger if exists gm_block_direct_role_status on public.group_members;
create trigger gm_block_direct_role_status
  before update on public.group_members
  for each row execute function public.trg_gm_block_direct_role_status();

-- ---------------------------------------------------------------------
-- A3. Audit : libellés supplémentaires pris en charge côté UI
-- ---------------------------------------------------------------------
-- Pas de schéma à modifier (action est text libre).
-- Voir src/lib/api/audit.ts pour la liste des labels affichables.

-- ---------------------------------------------------------------------
-- A4. Audit instrumentation : invitations
-- ---------------------------------------------------------------------
-- Un trigger côté DB garantit l'audit même si le frontend oublie.
create or replace function public.trg_audit_invitation_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      NEW.group_id, 'invitation_created', 'invitation', NEW.id,
      jsonb_build_object('code', NEW.code, 'max_uses', NEW.max_uses,
                         'expires_at', NEW.expires_at)
    );
  elsif tg_op = 'UPDATE' then
    if OLD.status is distinct from NEW.status and NEW.status = 'revoked' then
      perform public.log_audit(
        NEW.group_id, 'invitation_revoked', 'invitation', NEW.id,
        jsonb_build_object('code', NEW.code)
      );
    end if;
  end if;
  return NEW;
end; $$;

drop trigger if exists invitations_audit_insert on public.invitations;
create trigger invitations_audit_insert
  after insert on public.invitations
  for each row execute function public.trg_audit_invitation_event();

drop trigger if exists invitations_audit_update on public.invitations;
create trigger invitations_audit_update
  after update on public.invitations
  for each row execute function public.trg_audit_invitation_event();

-- ---------------------------------------------------------------------
-- Notes pour les RPC suivantes (Phase B+) :
--   Toute RPC qui mute group_members.role ou .status doit faire :
--     perform set_config('app.via_rpc','1', true);
--   en début de fonction (avant le UPDATE/INSERT).
-- ---------------------------------------------------------------------