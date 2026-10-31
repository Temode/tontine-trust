create or replace function public.admin_upsert_marketing_content(
  _code text, _channel text, _subject text, _body text
) returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_role(auth.uid(), 'super_admin') then raise exception 'FORBIDDEN'; end if;
  if _channel not in ('sms','email') then raise exception 'INVALID_CHANNEL'; end if;
  select id into v_id from public.marketing_campaigns where code = _code;
  if v_id is null then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  insert into public.marketing_campaign_contents(campaign_id, channel, subject, body, version, updated_at)
  values (v_id, _channel, _subject, _body, 1, now())
  on conflict (campaign_id, channel) do update
    set subject = excluded.subject,
        body = excluded.body,
        version = public.marketing_campaign_contents.version + 1,
        updated_at = now();
end; $$;

grant execute on function public.admin_upsert_marketing_content(text, text, text, text) to authenticated;