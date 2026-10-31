
create or replace function public.request_group_deletion(
  _group_id uuid,
  _reason text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_g public.groups%rowtype;
  v_open_turns int;
  v_pending_contribs int;
  v_pending_links int;
  v_succeeded_payments int;
  v_fast_track boolean;
  v_status public.deletion_request_status;
  v_deadline timestamptz;
  v_req_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(_reason,'') = '' then raise exception 'REASON_REQUIRED'; end if;

  select * into v_g from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if v_g.deleted_at is not null then raise exception 'ALREADY_DELETED'; end if;
  if v_g.created_by <> v_uid then raise exception 'FORBIDDEN'; end if;

  select count(*) into v_open_turns from public.turns
    where group_id = _group_id and status = 'collecting';
  if v_open_turns > 0 then raise exception 'OPEN_TURNS_REMAIN'; end if;

  -- Fast-track: aucun paiement reçu => saute le vote des membres
  select count(*) into v_succeeded_payments
    from public.payments p
    join public.contributions c on c.id = p.contribution_id
    where c.group_id = _group_id and p.status = 'succeeded';

  v_fast_track := (v_succeeded_payments = 0);

  if not v_fast_track then
    select count(*) into v_pending_contribs from public.contributions
      where group_id = _group_id and status = 'pending';
    if v_pending_contribs > 0 then raise exception 'PENDING_CONTRIBUTIONS'; end if;

    select count(*) into v_pending_links from public.payment_links pl
      join public.contributions c on c.id = pl.contribution_id
      where c.group_id = _group_id and pl.status = 'pending';
    if v_pending_links > 0 then raise exception 'PENDING_PAYMENT_LINKS'; end if;
  end if;

  if exists (
    select 1 from public.group_deletion_requests
    where group_id = _group_id and status in ('pending_members','pending_admin')
  ) then
    raise exception 'REQUEST_ALREADY_OPEN';
  end if;

  if v_fast_track then
    v_status := 'pending_admin';
    v_deadline := now();
  else
    v_status := 'pending_members';
    v_deadline := now() + interval '14 days';
  end if;

  insert into public.group_deletion_requests(group_id, requested_by, reason, status, members_deadline)
    values (_group_id, v_uid, _reason, v_status, v_deadline)
    returning id into v_req_id;

  insert into public.group_deletion_votes(request_id, user_id, vote)
    values (v_req_id, v_uid, 'yes');

  if v_fast_track then
    -- Notif info à l'organisateur uniquement
    insert into public.notifications(user_id, kind, title, body, group_id, data)
    values (v_uid, 'group_deletion_requested',
      'Demande transmise à Tontine Digital',
      'Aucune cotisation n''ayant été reçue pour "' || v_g.name || '", votre demande de suppression est transmise directement à l''équipe Tontine Digital.',
      _group_id,
      jsonb_build_object('request_id', v_req_id, 'fast_track', true, 'reason', _reason));
  else
    insert into public.notifications(user_id, kind, title, body, group_id, data)
    select gm.user_id, 'group_deletion_requested',
           'Demande de suppression du groupe',
           'L''organisateur de "' || v_g.name || '" demande la suppression du groupe. Vous avez 14 jours pour vous opposer.',
           _group_id,
           jsonb_build_object('request_id', v_req_id, 'deadline', v_deadline, 'reason', _reason)
    from public.group_members gm
    where gm.group_id = _group_id
      and gm.status = 'active'
      and gm.user_id <> v_uid;
  end if;

  perform public.log_audit(_group_id, 'deletion_requested', 'group_deletion_request', v_req_id,
    jsonb_build_object('reason', _reason, 'fast_track', v_fast_track));

  return v_req_id;
end; $$;

revoke all on function public.request_group_deletion(uuid, text) from public, anon;
grant execute on function public.request_group_deletion(uuid, text) to authenticated;
