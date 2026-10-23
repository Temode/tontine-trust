-- 1) Préférences : email activé pour 'system' + backfill des types manquants
create or replace function public.seed_notification_preferences(_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  k public.notification_kind;
  sms_default boolean;
  sms_critical text[] := array[
    'contribution_late','contribution_confirmed','contribution_due',
    'payout_released','payout_hold_extended',
    'turn_paid','turn_started','cycle_started','cycle_paused','cycle_resumed',
    'cycle_completed','due_date_shifted',
    'withdrawal_requested','withdrawal_processing','withdrawal_paid',
    'withdrawal_failed','withdrawal_cancelled',
    'payment_confirmed_by_admin','payment_rejected_by_admin',
    'penalty_adjusted','penalty_waived',
    'member_suspended','member_kicked','member_reactivated',
    'ownership_transferred',
    'payment_pause_request_approved','payment_pause_request_rejected',
    'dispute_raised','dispute_resolved',
    'defaulter_reported','defaulter_report_resolved',
    'group_deletion_requested','group_deletion_pending_admin',
    'group_deletion_approved','group_deletion_refused'
  ];
begin
  for k in select unnest(enum_range(null::public.notification_kind)) loop
    insert into public.notification_preferences(user_id, notif_type, channel, enabled)
    values (_user_id, k, 'in_app', true) on conflict do nothing;
    insert into public.notification_preferences(user_id, notif_type, channel, enabled)
    values (_user_id, k, 'email', true) on conflict do nothing;
    sms_default := (k::text = ANY (sms_critical));
    insert into public.notification_preferences(user_id, notif_type, channel, enabled)
    values (_user_id, k, 'sms', sms_default) on conflict do nothing;
  end loop;
end; $$;

update public.notification_preferences
   set enabled = true
 where channel = 'email' and notif_type::text = 'system' and enabled = false;

do $$
declare u uuid;
begin
  for u in select distinct user_id from public.notification_preferences loop
    perform public.seed_notification_preferences(u);
  end loop;
end $$;

-- 2) File d'emails : colonnes de reprise
alter table public.email_outbox
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz;

create index if not exists idx_email_outbox_retry
  on public.email_outbox (next_attempt_at)
  where status in ('queued','failed','processing');

-- 3) Classification des erreurs
create or replace function public.email_error_is_retryable(_err text)
returns boolean language sql immutable set search_path = public as $$
  select case
    when _err is null or _err = '' then true
    when _err ~ '^(429|5\d\d|403|408)' then true
    when _err ~* 'timeout|ECONNRESET|network|fetch failed|temporarily' then true
    when _err ~ '^4\d\d' then false   -- 400/422 : payload ou destinataire invalide
    else true
  end;
$$;

-- 4) Pop : reprend aussi les échecs récupérables et les envois figés
create or replace function public.email_outbox_pop(_limit int default 20)
returns setof public.email_outbox
language sql security definer set search_path = public as $$
  with cte as (
    select id from public.email_outbox
     where (
        (status = 'queued'  and next_attempt_at <= now())
     or (status = 'failed'  and attempts < 8
          and public.email_error_is_retryable(last_error)
          and next_attempt_at <= now())
     or (status = 'processing' and coalesce(locked_at, created_at) < now() - interval '10 minutes')
     )
     order by created_at
     limit greatest(_limit, 1)
     for update skip locked
  )
  update public.email_outbox o
     set status = 'processing',
         attempts = o.attempts + 1,
         locked_at = now()
    from cte
   where o.id = cte.id
  returning o.*;
$$;

-- 5) Mark : backoff exponentiel quand on remet en file
create or replace function public.email_outbox_mark(_id uuid, _status text, _error text default null)
returns void language sql security definer set search_path = public as $$
  update public.email_outbox
     set status = _status,
         last_error = _error,
         processed_at = now(),
         locked_at = null,
         next_attempt_at = case
           when _status = 'sent' then next_attempt_at
           else now() + make_interval(secs => least(3600, 60 * power(2, greatest(attempts - 1, 0))::int))
         end
   where id = _id;
$$;

-- 6) Rejeu ponctuel des échecs récupérables et des envois figés
update public.email_outbox
   set status = 'queued', attempts = 0, next_attempt_at = now(), locked_at = null
 where (status = 'failed' and public.email_error_is_retryable(last_error))
    or (status = 'processing' and coalesce(locked_at, created_at) < now() - interval '10 minutes');

-- 7) Supervision : alerte si trop d'échecs sur la dernière heure
create or replace function public.check_email_outbox_health()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_total int; v_failed int; v_stuck int; v_ratio numeric;
begin
  select count(*) filter (where processed_at >= now() - interval '1 hour'),
         count(*) filter (where processed_at >= now() - interval '1 hour' and status = 'failed'),
         count(*) filter (where status = 'processing' and coalesce(locked_at, created_at) < now() - interval '30 minutes')
    into v_total, v_failed, v_stuck
    from public.email_outbox;

  v_ratio := case when coalesce(v_total,0) = 0 then 0 else v_failed::numeric / v_total end;

  if (v_failed >= 10 and v_ratio >= 0.2) or v_stuck >= 20 then
    perform public.raise_ops_alert(
      'email_outbox_degraded',
      format('File emails dégradée : %s échecs / %s envois sur 1h (%s%%), %s bloqués.',
             v_failed, v_total, round(v_ratio * 100), v_stuck),
      jsonb_build_object('failed', v_failed, 'total', v_total, 'stuck', v_stuck),
      'error',
      null
    );
  end if;

  return jsonb_build_object('total', v_total, 'failed', v_failed, 'stuck', v_stuck);
end; $$;

select cron.unschedule('email-outbox-health') where exists (select 1 from cron.job where jobname = 'email-outbox-health');
select cron.schedule('email-outbox-health', '*/15 * * * *', $$select public.check_email_outbox_health();$$);

-- 8) Back-office : statistiques de la file (super_admin)
create or replace function public.admin_email_outbox_stats(_hours int default 24)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_res jsonb;
begin
  if not (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'admin')) then
    raise exception 'forbidden';
  end if;

  select jsonb_build_object(
    'by_status', coalesce((
      select jsonb_object_agg(status, n) from (
        select status, count(*)::int n from public.email_outbox
         where created_at >= now() - make_interval(hours => greatest(_hours,1))
         group by status
      ) s), '{}'::jsonb),
    'by_kind', coalesce((
      select jsonb_agg(jsonb_build_object('kind', kind, 'status', status, 'count', n) order by n desc) from (
        select kind, status, count(*)::int n from public.email_outbox
         where created_at >= now() - make_interval(hours => greatest(_hours,1))
         group by kind, status
      ) k), '[]'::jsonb),
    'pending_now', (select count(*)::int from public.email_outbox where status in ('queued','processing')),
    'recent_errors', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'kind', kind, 'attempts', attempts,
               'error', left(coalesce(last_error,''), 200),
               'retryable', public.email_error_is_retryable(last_error),
               'created_at', created_at) order by created_at desc)
        from (select * from public.email_outbox where status = 'failed'
               order by created_at desc limit 20) e), '[]'::jsonb)
  ) into v_res;

  return v_res;
end; $$;

create or replace function public.admin_email_outbox_retry(_id uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'admin')) then
    raise exception 'forbidden';
  end if;
  update public.email_outbox
     set status = 'queued', attempts = 0, next_attempt_at = now(), locked_at = null
   where status = 'failed' and (_id is null or id = _id);
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

grant execute on function public.admin_email_outbox_stats(int) to authenticated;
grant execute on function public.admin_email_outbox_retry(uuid) to authenticated;
revoke execute on function public.check_email_outbox_health() from anon, authenticated;