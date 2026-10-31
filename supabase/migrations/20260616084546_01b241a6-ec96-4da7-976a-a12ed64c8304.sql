alter table public.contributions
  add column if not exists penalty_amount bigint not null default 0
    check (penalty_amount >= 0);

create or replace function public.record_mock_payment(
  _contribution_id uuid,
  _provider public.payment_provider default 'simulation'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_contrib public.contributions%rowtype;
  v_turn public.turns%rowtype;
  v_group public.groups%rowtype;
  v_payment_id uuid;
  v_remaining int;
  v_penalty bigint := 0;
  v_total bigint;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_contrib from public.contributions where id = _contribution_id;
  if not found then raise exception 'CONTRIBUTION_NOT_FOUND'; end if;
  if v_contrib.payer_user_id <> v_user then raise exception 'FORBIDDEN'; end if;
  if v_contrib.status = 'confirmed' then raise exception 'ALREADY_PAID'; end if;
  select * into v_turn  from public.turns  where id = v_contrib.turn_id;
  select * into v_group from public.groups where id = v_contrib.group_id;
  if v_group.late_penalty_percent > 0
     and (current_date - v_turn.due_date) > v_group.late_penalty_after_days then
    v_penalty := (v_contrib.amount * v_group.late_penalty_percent) / 100;
  end if;
  v_total := v_contrib.amount + v_penalty;
  insert into public.payments (contribution_id, group_id, user_id, amount, provider, provider_ref, status, initiated_at, settled_at)
  values (v_contrib.id, v_contrib.group_id, v_user, v_total, _provider,
    'MOCK-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), 'succeeded', now(), now())
  returning id into v_payment_id;
  update public.contributions set status = 'confirmed', provider = _provider,
    reference = (select provider_ref from public.payments where id = v_payment_id),
    penalty_amount = v_penalty, submitted_at = now(), confirmed_at = now(), confirmed_by = v_user
  where id = v_contrib.id;
  perform public.append_ledger(v_contrib.group_id, v_turn.cycle_id, v_turn.id, v_contrib.id, v_payment_id,
    v_user, 'contribution_in', v_contrib.amount, 'Cotisation tour #' || v_turn.turn_number);
  if v_penalty > 0 then
    perform public.append_ledger(v_contrib.group_id, v_turn.cycle_id, v_turn.id, v_contrib.id, v_payment_id,
      v_user, 'penalty', v_penalty, 'Pénalité de retard (' || v_group.late_penalty_percent || '%)');
  end if;
  select count(*) into v_remaining from public.contributions where turn_id = v_turn.id and status <> 'confirmed';
  if v_remaining = 0 and v_turn.status <> 'paid' then
    update public.turns set status = ('collecting'::public.turn_status) where id = v_turn.id and status <> 'paid';
    insert into public.notifications (user_id, kind, title, body, group_id)
    values (v_turn.beneficiary_user_id, 'contribution_received', 'Cagnotte complète',
      'Toutes les cotisations de votre tour ont été reçues. Versement à venir.', v_turn.group_id);
  end if;
  return v_payment_id;
end; $$;

grant execute on function public.record_mock_payment(uuid, public.payment_provider) to authenticated;

create or replace view public.my_contributions_due
with (security_invoker = true) as
select c.id as contribution_id, c.turn_id, c.group_id, g.name as group_name, c.amount, c.status,
  t.turn_number, t.due_date, t.beneficiary_user_id, pb.full_name as beneficiary_name,
  (t.due_date - current_date) as days_to_due,
  case when g.late_penalty_percent > 0 and (current_date - t.due_date) > g.late_penalty_after_days
    then (c.amount * g.late_penalty_percent) / 100 else 0 end as expected_penalty
from public.contributions c
join public.turns t on t.id = c.turn_id
join public.groups g on g.id = c.group_id
left join public.profiles pb on pb.id = t.beneficiary_user_id
where c.payer_user_id = auth.uid()
  and c.status in ('pending', 'submitted', 'rejected')
  and t.status in ('upcoming', 'collecting')
order by t.due_date asc;