alter table public.profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_reason text;

create or replace function public.delete_account(_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_active_owned int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select count(*) into v_active_owned
    from public.groups
    where created_by = v_uid
      and status in ('active', 'collecting', 'paused');
  if v_active_owned > 0 then
    raise exception 'OWNS_ACTIVE_GROUPS'
      using hint = 'Transférez ou archivez vos groupes avant suppression.';
  end if;

  perform set_config('app.via_rpc', '1', true);

  update public.profiles set
    full_name = 'Utilisateur supprimé',
    phone_number = null,
    avatar_url = null,
    deleted_at = now(),
    deletion_reason = _reason
  where id = v_uid;

  delete from public.notifications where user_id = v_uid;

  begin
    delete from public.notification_prefs where user_id = v_uid;
  exception when undefined_table then null; end;

  begin
    delete from public.manual_reminders_log
      where recipient_id = v_uid or sender_id = v_uid;
  exception when undefined_table then null; end;

  begin
    update public.member_reviews set comment = null
    where reviewer_id = v_uid;
  exception when undefined_table or undefined_column then null; end;

  update public.group_members
    set status = 'removed'
    where user_id = v_uid and status <> 'removed';

  perform public.log_audit(null, 'account_deleted', 'profile', v_uid,
    jsonb_build_object('reason', _reason));
end; $$;
grant execute on function public.delete_account(text) to authenticated, service_role;