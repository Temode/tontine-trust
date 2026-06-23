
-- =====================================================================
-- 49 — SMS retard + pénalité + escalade automatique
-- =====================================================================

create or replace function public.apply_djomy_webhook(
  _payment_id uuid,
  _new_status text,
  _provider_ref text,
  _paid_amount bigint,
  _payment_method text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments%rowtype;
  v_contrib public.contributions%rowtype;
  v_turn public.turns%rowtype;
  v_group public.groups%rowtype;
  v_remaining int;
  v_penalty bigint := 0;
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
  select * into v_turn  from public.turns  where id = v_contrib.turn_id;
  select * into v_group from public.groups where id = v_contrib.group_id;

  if v_group.late_penalty_percent > 0
     and (current_date - v_turn.due_date) > v_group.late_penalty_after_days then
    v_penalty := (v_contrib.amount * v_group.late_penalty_percent) / 100;
  end if;

  update public.contributions set
    status = 'confirmed',
    provider = 'djomy',
    reference = coalesce(_provider_ref, v_contrib.reference),
    penalty_amount = v_penalty,
    submitted_at = coalesce(v_contrib.submitted_at, now()),
    confirmed_at = now(),
    confirmed_by = v_payment.user_id
  where id = v_contrib.id;

  perform public.append_ledger(
    v_contrib.group_id, v_turn.cycle_id, v_turn.id, v_contrib.id, v_payment.id,
    v_payment.user_id, 'contribution_in', v_contrib.amount,
    'Cotisation Djomy tour #' || v_turn.turn_number
  );

  if v_penalty > 0 then
    perform public.append_ledger(
      v_contrib.group_id, v_turn.cycle_id, v_turn.id, v_contrib.id, v_payment.id,
      v_payment.user_id, 'penalty', v_penalty,
      'Pénalité de retard (' || v_group.late_penalty_percent || '%)'
    );
  end if;

  select count(*) into v_remaining
    from public.contributions
    where turn_id = v_turn.id and status <> 'confirmed';

  if v_remaining = 0 and v_turn.status <> 'paid' then
    update public.turns
      set status = ('collecting'::public.turn_status)
      where id = v_turn.id and status <> 'paid';

    insert into public.notifications (user_id, kind, title, body, group_id)
    values (v_turn.beneficiary_user_id, 'contribution_received',
      'Cagnotte complète',
      'Toutes les cotisations de votre tour ont été reçues. Versement à venir.',
      v_turn.group_id);
  end if;

  update public.group_members
     set status = 'active'::public.member_status,
         suspended_at = null,
         suspended_reason = null,
         suspended_by = null
   where group_id = v_contrib.group_id
     and user_id = v_payment.user_id
     and status = 'suspended'::public.member_status
     and suspended_reason = 'late_payment';

  begin
    perform public.log_audit(
      v_contrib.group_id, 'djomy_payment_confirmed', 'contribution', v_contrib.id,
      jsonb_build_object('payment_id', v_payment.id, 'amount', _paid_amount,
                         'penalty', v_penalty,
                         'method', _payment_method, 'provider_ref', _provider_ref)
    );
  exception when others then null; end;
end; $$;
grant execute on function public.apply_djomy_webhook(uuid, text, text, bigint, text) to service_role;

-- 2. Vue rappels
create or replace view public.pending_reminders_view
with (security_invoker = true) as
select
  c.id                                       as contribution_id,
  c.payer_user_id,
  c.group_id,
  g.name                                     as group_name,
  c.turn_id,
  t.turn_number,
  t.due_date,
  c.amount,
  g.late_penalty_percent,
  g.late_penalty_after_days,
  (current_date - t.due_date)                as days_late,
  case
    when g.late_penalty_percent > 0
         and (current_date - t.due_date) > g.late_penalty_after_days
    then (c.amount * g.late_penalty_percent) / 100
    else 0
  end                                        as expected_penalty,
  case (t.due_date - current_date)
    when  2 then 'J-2'
    when  1 then 'J-1'
    when  0 then 'J0'
    when -1 then 'J+1'
    when -3 then 'J+3'
    when -7 then 'J+7'
    when -14 then 'J+14'
    else null
  end                                        as bucket
from public.contributions c
join public.turns  t on t.id = c.turn_id
join public.groups g on g.id = c.group_id
where c.status in ('pending','submitted','rejected')
  and t.status in ('upcoming','collecting')
  and g.status in ('open'::public.group_status,'active'::public.group_status)
  and (t.due_date - current_date) in (2,1,0,-1,-3,-7,-14);

grant select on public.pending_reminders_view to service_role, authenticated;

-- 3. enqueue_payment_reminders étendu
create or replace function public.enqueue_payment_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_inserted int := 0;
  v_today date := current_date;
  rec record;
  v_diff int;
  v_existing int;
begin
  for rec in
    select * from public.pending_reminders_view where bucket is not null
  loop
    v_diff := rec.due_date - v_today;

    if exists (
      select 1 from public.reminder_log
      where contribution_id = rec.contribution_id
        and sent_on = v_today
        and bucket = rec.bucket
    ) then continue; end if;

    insert into public.notifications (user_id, kind, title, body, group_id, turn_id, link, data)
    values (
      rec.payer_user_id,
      'contribution_due'::public.notification_kind,
      case when v_diff >= 0 then 'Rappel cotisation' else 'Cotisation en retard' end,
      coalesce(rec.group_name,'Groupe') || ' — tour #' || rec.turn_number ||
        case
          when v_diff > 0 then ' · échéance dans ' || v_diff || ' j'
          when v_diff = 0 then ' · échéance aujourd''hui'
          else ' · ' || abs(v_diff) || ' j de retard' ||
               case when rec.expected_penalty > 0
                    then ' · pénalité ' || rec.expected_penalty || ' GNF'
                    else '' end
        end,
      rec.group_id, rec.turn_id, '/cotisations',
      jsonb_build_object(
        'bucket', rec.bucket,
        'amount', rec.amount,
        'expected_penalty', rec.expected_penalty,
        'days_late', rec.days_late,
        'late_penalty_percent', rec.late_penalty_percent
      )
    );

    insert into public.reminder_log (contribution_id, sent_on, bucket)
    values (rec.contribution_id, v_today, rec.bucket);

    if rec.bucket = 'J+7' then
      select count(*) into v_existing from public.member_default_reports
        where contribution_id = rec.contribution_id;
      if v_existing = 0 then
        insert into public.member_default_reports (
          group_id, reported_user_id, reported_by, contribution_id, reason, status
        ) values (
          rec.group_id, rec.payer_user_id, rec.payer_user_id, rec.contribution_id,
          'Signalement automatique : cotisation impayée depuis ' || rec.days_late || ' jours.',
          'auto_flagged'
        );
        insert into public.notifications (user_id, kind, title, body, group_id, data)
        select gm.user_id, 'defaulter_reported'::public.notification_kind,
               'Membre en défaut détecté',
               'Un membre est en retard depuis ' || rec.days_late || ' jours sur le tour #' || rec.turn_number || '.',
               rec.group_id,
               jsonb_build_object('contribution_id', rec.contribution_id, 'auto', true)
        from public.group_members gm
        where gm.group_id = rec.group_id
          and gm.status = 'active'::public.member_status
          and gm.role in ('organizer'::public.member_role, 'co_organizer'::public.member_role);
      end if;
    end if;

    if rec.bucket = 'J+14' then
      update public.group_members
         set status = 'suspended'::public.member_status,
             suspended_at = coalesce(suspended_at, now()),
             suspended_reason = 'late_payment'
       where group_id = rec.group_id
         and user_id = rec.payer_user_id
         and status = 'active'::public.member_status;

      insert into public.notifications (user_id, kind, title, body, group_id, data)
      values (rec.payer_user_id, 'member_suspended'::public.notification_kind,
        'Droits suspendus',
        'Vos droits (vote, enchères) sont suspendus suite à 14 jours de retard sur le tour #' || rec.turn_number || '. Réglez la cotisation pour réactiver votre compte.',
        rec.group_id,
        jsonb_build_object('contribution_id', rec.contribution_id, 'auto', true));
    end if;

    v_inserted := v_inserted + 1;
  end loop;
  return v_inserted;
end; $$;

grant execute on function public.enqueue_payment_reminders() to service_role;

notify pgrst, 'reload schema';
