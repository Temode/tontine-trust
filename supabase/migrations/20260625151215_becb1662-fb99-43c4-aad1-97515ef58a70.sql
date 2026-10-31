
create or replace function public.sms_outbox_try_lock()
returns boolean
language sql security definer set search_path = public as $$
  select pg_try_advisory_lock(8731298731298731);
$$;

create or replace function public.sms_outbox_unlock()
returns boolean
language sql security definer set search_path = public as $$
  select pg_advisory_unlock(8731298731298731);
$$;

revoke all on function public.sms_outbox_try_lock() from public;
revoke all on function public.sms_outbox_unlock() from public;
grant execute on function public.sms_outbox_try_lock() to service_role;
grant execute on function public.sms_outbox_unlock() to service_role;
