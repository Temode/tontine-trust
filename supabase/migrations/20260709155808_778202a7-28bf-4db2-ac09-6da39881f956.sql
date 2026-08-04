CREATE OR REPLACE FUNCTION public.has_admin_permission(_group uuid, _user uuid, _perm text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_owner boolean := false;
  v_ok boolean := false;
begin
  if _group is null or _user is null or _perm is null then
    return false;
  end if;

  select public.is_group_owner(_group, _user) into v_owner;
  if coalesce(v_owner, false) then
    return true;
  end if;

  select case _perm
    when 'can_approve_members' then coalesce(gap.can_approve_members, false)
    when 'can_suspend_member' then coalesce(gap.can_suspend_member, false)
    when 'can_kick_member' then coalesce(gap.can_kick_member, false)
    when 'can_edit_settings' then coalesce(gap.can_edit_settings, false)
    when 'can_manage_invitations' then coalesce(gap.can_manage_invitations, false)
    when 'can_confirm_payments' then coalesce(gap.can_confirm_payments, false)
    when 'can_waive_penalty' then coalesce(gap.can_waive_penalty, false)
    when 'can_send_announcements' then coalesce(gap.can_send_announcements, false)
    when 'can_pause_cycle' then coalesce(gap.can_pause_cycle, false)
    when 'can_report_defaulter' then coalesce(gap.can_report_defaulter, false)
    else false
  end into v_ok
  from public.group_admin_permissions gap
  where gap.group_id = _group
    and gap.user_id = _user;

  return coalesce(v_ok, false);
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.has_admin_permission(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_admin_permission(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(uuid, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
DROP POLICY IF EXISTS profiles_select_visible_to_self_group_or_admin ON public.profiles;
CREATE POLICY profiles_select_visible_to_self_group_or_admin
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.group_members viewer
    JOIN public.group_members subject
      ON subject.group_id = viewer.group_id
    WHERE viewer.user_id = auth.uid()
      AND viewer.removed_at IS NULL
      AND viewer.status = 'active'::public.member_status
      AND subject.user_id = profiles.id
      AND subject.removed_at IS NULL
      AND subject.status = 'active'::public.member_status
  )
);

CREATE OR REPLACE VIEW public.admin_user_overview
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.full_name,
  p.phone_number,
  p.avatar_url,
  p.reliability_score,
  p.created_at,
  p.suspended_at,
  p.deleted_at,
  (
    SELECT array_agg((ur.role)::text)
    FROM public.user_roles ur
    WHERE ur.user_id = p.id
  ) AS roles,
  (
    SELECT count(*)
    FROM public.group_members gm
    WHERE gm.user_id = p.id
      AND gm.removed_at IS NULL
  ) AS groups_count,
  NULL::character varying(255) AS email
FROM public.profiles p
WHERE public.has_role(auth.uid(), 'super_admin'::public.app_role);

GRANT SELECT ON public.admin_user_overview TO authenticated;

DO $$
DECLARE
  v record;
BEGIN
  FOR v IN
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
  LOOP
    EXECUTE format('ALTER VIEW %I.%I SET (security_invoker = true)', v.nspname, v.relname);
  END LOOP;
END $$;