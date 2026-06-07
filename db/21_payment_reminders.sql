-- P1.3 — Rappels automatiques de paiement (CRON)
-- Idempotent.

create table if not exists public.reminder_log (
  contribution_id uuid not null references public.contributions(id) on delete cascade,
  sent_on date not null default current_date,
  bucket text not null,  -- 'J-2' | 'J-1' | 'J0' | 'J+1' | 'J+3'
  created_at timestamptz not null default now(),
  primary key (contribution_id, sent_on, bucket)
);

grant select on public.reminder_log to authenticated;
grant all on public.reminder_log to service_role;
alter table public.reminder_log enable row level security;

create or replace function public.enqueue_payment_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_inserted int := 0;
  v_today date := current_date;
  rec record;
  v_bucket text;
  v_due date;
  v_diff int;
  v_group_name text;
begin
  for rec in
    select c.id as contribution_id, c.payer_user_id, c.turn_id, c.amount,
           t.due_date::date as due_date, t.group_id, t.turn_number
    from public.contributions c
    join public.turns t on t.id = c.turn_id
    where c.status = 'pending'
      and t.status in ('upcoming', 'collecting')
  loop
    v_due := rec.due_date;
    v_diff := v_due - v_today;
    v_bucket := case
      when v_diff = 2 then 'J-2'
      when v_diff = 1 then 'J-1'
      when v_diff = 0 then 'J0'
      when v_diff = -1 then 'J+1'
      when v_diff <= -3 then 'J+3'
      else null
    end;
    if v_bucket is null then continue; end if;

    -- idempotence
    if exists (
      select 1 from public.reminder_log
      where contribution_id = rec.contribution_id
        and sent_on = v_today
        and bucket = v_bucket
    ) then continue; end if;

    select name into v_group_name from public.groups where id = rec.group_id;

    insert into public.notifications (user_id, kind, title, body, group_id, turn_id, link)
    values (
      rec.payer_user_id,
      'contribution_due'::public.notification_kind,
      case when v_diff >= 0 then 'Rappel cotisation' else 'Cotisation en retard' end,
      coalesce(v_group_name, 'Groupe') || ' — tour #' || rec.turn_number ||
        case
          when v_diff > 0 then ' · échéance dans ' || v_diff || ' j'
          when v_diff = 0 then ' · échéance aujourd''hui'
          else ' · ' || abs(v_diff) || ' j de retard'
        end,
      rec.group_id, rec.turn_id,
      '/cotisations'
    );

    insert into public.reminder_log (contribution_id, sent_on, bucket)
    values (rec.contribution_id, v_today, v_bucket);

    v_inserted := v_inserted + 1;
  end loop;
  return v_inserted;
end; $$;

grant execute on function public.enqueue_payment_reminders() to service_role;

-- Planification quotidienne 08:00 UTC
do $$
declare
  v_jobid int;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_jobid from cron.job where jobname = 'tontine_payment_reminders';
    if v_jobid is not null then
      perform cron.unschedule(v_jobid);
    end if;
    perform cron.schedule(
      'tontine_payment_reminders',
      '0 8 * * *',
      $cron$ select public.enqueue_payment_reminders(); $cron$
    );
  end if;
end $$;
