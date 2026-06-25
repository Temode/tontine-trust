CREATE OR REPLACE FUNCTION public.admin_decide_deletion(_request_id uuid, _approve boolean, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_req public.group_deletion_requests%rowtype;
  v_g public.groups%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_super_admin(v_uid) then raise exception 'FORBIDDEN'; end if;

  select * into v_req from public.group_deletion_requests where id = _request_id;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status <> 'pending_admin' then raise exception 'NOT_PENDING_ADMIN'; end if;

  select * into v_g from public.groups where id = v_req.group_id;

  update public.group_deletion_requests
    set status = case when _approve then 'approved'::deletion_request_status else 'rejected'::deletion_request_status end,
        admin_decision_by = v_uid,
        admin_decision_at = now(),
        admin_decision_reason = _reason,
        updated_at = now()
    where id = _request_id;

  if _approve then
    update public.groups
      set deleted_at = now(),
          deletion_request_id = _request_id,
          status = 'cancelled'
      where id = v_req.group_id;
  end if;

  insert into public.notifications(user_id, kind, title, body, group_id, data)
  select gm.user_id,
         (case when _approve then 'group_deletion_approved' else 'group_deletion_refused' end)::notification_kind,
         case when _approve then 'Groupe supprimé' else 'Suppression refusée' end,
         case when _approve
              then 'Tontine a approuvé la suppression de "' || v_g.name || '". L''historique reste archivé pour 6 ans.'
              else 'Tontine a refusé la suppression de "' || v_g.name || '"' || coalesce(' : ' || _reason, '.') end,
         v_req.group_id,
         jsonb_build_object('request_id', _request_id, 'reason', _reason)
  from public.group_members gm
  where gm.group_id = v_req.group_id and gm.status in ('active','suspended');

  perform public.log_audit(v_req.group_id, 'deletion_admin_decision', 'group_deletion_request', _request_id,
    jsonb_build_object('approved', _approve, 'reason', _reason));
end; $function$;