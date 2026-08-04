create or replace function public.dispatch_notification_marketing_fallback(
  _user_id uuid, _kind public.notification_kind, _skipped text, _group_name text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if _skipped is null or _skipped not in ('plan_free','wallet_empty') then return; end if;
  if not public.notification_kind_is_sms_critical(_kind) then return; end if;
  perform public.enqueue_marketing_message(
    'sms_missed_event', 'sms', _user_id,
    jsonb_build_object('groupe', coalesce(_group_name, 'vos tontines')),
    null
  );
end; $$;

grant execute on function public.dispatch_notification_marketing_fallback(uuid, public.notification_kind, text, text) to service_role, authenticated;