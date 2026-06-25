
-- 1) Clé d'idempotence renforcée : si aucun scope_id (contribution/turn/withdrawal),
--    on ajoute la date UTC pour borner à un envoi par (kind, user) et par jour.
create or replace function public.enqueue_tontine_sms(
  _kind text,
  _payload jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_key text;
  v_scope text;
  v_user  text;
  v_bucket text;
begin
  v_scope := coalesce(
    nullif(_payload->>'contribution_id',''),
    nullif(_payload->>'turn_id',''),
    nullif(_payload->>'withdrawal_id',''),
    nullif(_payload->>'scope_id','')
  );
  v_user := coalesce(
    nullif(_payload->>'payer_user_id',''),
    nullif(_payload->>'beneficiary_user_id',''),
    nullif(_payload->>'user_id',''),
    nullif(_payload->>'to',''),
    '-'
  );
  v_bucket := coalesce(
    nullif(_payload->>'bucket',''),
    to_char((now() at time zone 'UTC')::date, 'YYYY-MM-DD')
  );

  v_key := coalesce(
    nullif(_payload->>'dedupe_key',''),
    _kind || ':' || v_user || ':' || coalesce(v_scope, 'day=' || v_bucket)
  );

  insert into public.sms_outbox(kind, payload, dedupe_key)
  values (_kind, _payload, v_key)
  on conflict (dedupe_key) do nothing;
exception when others then
  raise warning '[enqueue_tontine_sms] échec: %', sqlerrm;
end; $$;

revoke all on function public.enqueue_tontine_sms(text, jsonb) from public;
grant execute on function public.enqueue_tontine_sms(text, jsonb) to service_role;

-- 2) Configuration : plafond global SMS/minute (toute la plateforme).
insert into public.internal_config(key, value)
values ('sms_max_per_minute_global', '30')
on conflict (key) do nothing;

-- 3) Compteur de SMS envoyés récemment (fenêtre glissante en minutes).
create or replace function public.sms_outbox_recent_sent_count(_minutes int default 1)
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
    from public.sms_outbox
   where status = 'sent'
     and processed_at >= now() - make_interval(mins => greatest(_minutes, 1));
$$;

revoke all on function public.sms_outbox_recent_sent_count(int) from public;
grant execute on function public.sms_outbox_recent_sent_count(int) to service_role;
