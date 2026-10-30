
-- ============================================================
-- 47_late_payment_alerts.sql — Alertes retard cotisation J+1
-- ============================================================

-- 1. Nouveau kind de notification
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'notification_kind' and e.enumlabel = 'contribution_late'
  ) then
    alter type public.notification_kind add value 'contribution_late';
  end if;
end$$;

-- 2. Index unique partiel pour 1 seule alerte active par contribution
create unique index if not exists tontine_alerts_late_unique
  on public.tontine_alerts (contribution_id)
  where code = 'late_contribution' and resolved_at is null;

-- 3. Fonction principale : crée notifications + alertes (idempotent)
create or replace function public.enqueue_late_payment_alerts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  r record;
begin
  for r in
    select
      c.id as contribution_id,
      c.payer_user_id,
      c.group_id,
      c.amount,
      t.id as turn_id,
      t.turn_number,
      t.due_date,
      g.name as group_name,
      g.late_penalty_percent,
      (current_date - t.due_date)::int as days_late
    from public.contributions c
    join public.turns t on t.id = c.turn_id
    join public.groups g on g.id = c.group_id
    where c.status in ('pending','rejected')
      and t.status in ('upcoming','collecting')
      and (current_date - t.due_date) >= 1
  loop
    -- Alerte organisateur (1 seule active par contribution)
    insert into public.tontine_alerts (group_id, turn_id, contribution_id, severity, code, message, metadata)
    values (
      r.group_id, r.turn_id, r.contribution_id,
      case when r.days_late >= 3 then 'critical' else 'warning' end,
      'late_contribution',
      'Cotisation tour #' || r.turn_number || ' en retard de ' || r.days_late || ' jour(s) — ' || r.group_name,
      jsonb_build_object(
        'days_late', r.days_late,
        'amount', r.amount,
        'payer_user_id', r.payer_user_id,
        'turn_number', r.turn_number
      )
    )
    on conflict do nothing;

    -- Notification quotidienne au membre (idempotent via reminder_log bucket LATE_Jn)
    if not exists (
      select 1 from public.reminder_log
      where contribution_id = r.contribution_id
        and sent_on = current_date
        and bucket = 'LATE_J' || r.days_late
    ) then
      insert into public.notifications (user_id, kind, title, body, group_id, turn_id, link)
      values (
        r.payer_user_id,
        'contribution_late',
        'Cotisation en retard',
        'Votre cotisation du tour #' || r.turn_number || ' (' || r.group_name || ') est en retard de '
          || r.days_late || ' jour(s). Réglez sans délai pour éviter la pénalité.',
        r.group_id,
        r.turn_id,
        '/solde'
      );

      insert into public.reminder_log (contribution_id, sent_on, bucket)
      values (r.contribution_id, current_date, 'LATE_J' || r.days_late)
      on conflict do nothing;

      v_count := v_count + 1;
    end if;
  end loop;

  -- Auto-résolution des alertes pour contributions désormais confirmées
  update public.tontine_alerts a
    set resolved_at = now()
    where a.code = 'late_contribution'
      and a.resolved_at is null
      and exists (
        select 1 from public.contributions c
        where c.id = a.contribution_id and c.status = 'confirmed'
      );

  return v_count;
end;
$$;

grant execute on function public.enqueue_late_payment_alerts() to authenticated, service_role;

-- 4. Trigger auto-résolution dès qu'une contribution est confirmée
create or replace function public.resolve_late_alert_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'confirmed' and (old.status is distinct from 'confirmed') then
    update public.tontine_alerts
      set resolved_at = now()
      where contribution_id = new.id
        and code = 'late_contribution'
        and resolved_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_resolve_late_alert_on_confirm on public.contributions;
create trigger trg_resolve_late_alert_on_confirm
  after update of status on public.contributions
  for each row execute function public.resolve_late_alert_on_confirm();

-- 5. Cron horaire 8h-22h UTC : lance les alertes + l'envoi SMS
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('tontine-late-alerts-hourly')
      where exists (select 1 from cron.job where jobname = 'tontine-late-alerts-hourly');
    perform cron.schedule(
      'tontine-late-alerts-hourly',
      '5 8-22 * * *',
      $cmd$
        select public.enqueue_late_payment_alerts();
        select net.http_post(
          url := 'https://oljyzmannzejtsbfpzxp.supabase.co/functions/v1/send-tontine-reminders',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sanl6bWFubnplanRzYmZwenhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NzUxMDMsImV4cCI6MjA5NzE1MTEwM30.q0JN5DH-T1hMgrbiuYek9Huw4H9qTh9KazisTPQzVrE'
          ),
          body := jsonb_build_object('triggered_at', now(), 'source','hourly_late_alerts')
        );
      $cmd$
    );
  end if;
end$$;

-- 6. Realtime pour les alertes (no-op si déjà présent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='tontine_alerts'
  ) then
    alter publication supabase_realtime add table public.tontine_alerts;
  end if;
end$$;
