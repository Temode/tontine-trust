
alter table public.call_requests
  add column if not exists recording_url text,
  add column if not exists recording_size bigint,
  add column if not exists recording_duration_seconds int,
  add column if not exists recording_consent_user_ids uuid[] not null default '{}'::uuid[];

create or replace function public.give_call_recording_consent(p_call_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_group_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select group_id into v_group_id from public.call_requests where id = p_call_id;
  if v_group_id is null then raise exception 'CALL_NOT_FOUND'; end if;
  if not exists (select 1 from public.group_members
    where group_id = v_group_id and user_id = auth.uid() and status = 'active')
  then raise exception 'NOT_A_MEMBER'; end if;
  update public.call_requests
     set recording_consent_user_ids =
       (select array(select distinct unnest(recording_consent_user_ids || array[auth.uid()]))),
         updated_at = now()
   where id = p_call_id;
end; $$;
grant execute on function public.give_call_recording_consent(uuid) to authenticated;

create or replace function public.set_call_recording(
  p_call_id uuid, p_url text, p_size bigint, p_duration int
) returns void language plpgsql security definer set search_path = public as $$
declare v_group_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select group_id into v_group_id from public.call_requests where id = p_call_id;
  if v_group_id is null then raise exception 'CALL_NOT_FOUND'; end if;
  if not exists (select 1 from public.group_members
    where group_id = v_group_id and user_id = auth.uid() and status = 'active')
  then raise exception 'NOT_A_MEMBER'; end if;
  update public.call_requests
     set recording_url = p_url, recording_size = p_size,
         recording_duration_seconds = p_duration, updated_at = now()
   where id = p_call_id;
end; $$;
grant execute on function public.set_call_recording(uuid, text, bigint, int) to authenticated;
