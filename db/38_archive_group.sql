-- =====================================================================
-- Phase C4 — Archivage propre du groupe
-- Idempotent.
-- =====================================================================

alter table public.groups
  add column if not exists archived_at      timestamptz,
  add column if not exists archived_reason  text,
  add column if not exists archived_by      uuid references auth.users(id);

create or replace function public.archive_group(_group_id uuid, _reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_g public.groups%rowtype;
  v_open int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_g from public.groups where id = _group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;

  if not (public.is_group_owner(_group_id, v_uid)
          or public.has_admin_permission(_group_id, v_uid, 'can_edit_settings')) then
    raise exception 'FORBIDDEN';
  end if;
  if v_g.status = 'cancelled' then raise exception 'ALREADY_ARCHIVED'; end if;

  select count(*) into v_open from public.turns
    where group_id = _group_id and status = 'collecting';
  if v_open > 0 then raise exception 'OPEN_TURNS_REMAIN'; end if;

  perform set_config('app.via_rpc', '1', true);
  update public.groups set
    status = 'cancelled',
    archived_at = now(),
    archived_reason = _reason,
    archived_by = v_uid
  where id = _group_id;

  insert into public.notifications (user_id, kind, title, body, group_id, data)
  select gm.user_id, 'group_archived',
         'Groupe archivé',
         coalesce(_reason, 'Le groupe a été archivé. L''historique reste consultable.'),
         _group_id, jsonb_build_object('archived_at', now())
  from public.group_members gm
  where gm.group_id = _group_id and gm.status in ('active', 'suspended');

  perform public.log_audit(_group_id, 'group_archived', 'group', _group_id,
    jsonb_build_object('reason', _reason));
end; $$;
grant execute on function public.archive_group(uuid, text) to authenticated;