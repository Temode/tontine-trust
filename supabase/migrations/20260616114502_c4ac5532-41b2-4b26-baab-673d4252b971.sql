
-- ============ Admin back-office: tables, views, RPCs, policies ============

-- 1) Suspension utilisateur sur profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES auth.users(id);

-- 2) Policies admin SELECT (additives, OR-combinées avec les policies existantes)
DROP POLICY IF EXISTS "super_admin_select_profiles" ON public.profiles;
CREATE POLICY "super_admin_select_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin_update_profiles" ON public.profiles;
CREATE POLICY "super_admin_update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin_select_groups" ON public.groups;
CREATE POLICY "super_admin_select_groups" ON public.groups
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin_update_groups" ON public.groups;
CREATE POLICY "super_admin_update_groups" ON public.groups
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin_select_group_members" ON public.group_members;
CREATE POLICY "super_admin_select_group_members" ON public.group_members
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin_select_payments" ON public.payments;
CREATE POLICY "super_admin_select_payments" ON public.payments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin_select_audit" ON public.audit_log;
CREATE POLICY "super_admin_select_audit" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin_select_turns" ON public.turns;
CREATE POLICY "super_admin_select_turns" ON public.turns
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin_select_cycles" ON public.cycles;
CREATE POLICY "super_admin_select_cycles" ON public.cycles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin_select_contributions" ON public.contributions;
CREATE POLICY "super_admin_select_contributions" ON public.contributions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin_select_user_roles" ON public.user_roles;
CREATE POLICY "super_admin_select_user_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 3) Vues admin (security_invoker = respectent RLS du caller, ie super_admin)
DROP VIEW IF EXISTS public.admin_platform_kpis;
CREATE VIEW public.admin_platform_kpis WITH (security_invoker=on) AS
SELECT
  (SELECT count(*) FROM public.profiles WHERE deleted_at IS NULL) AS users_total,
  (SELECT count(*) FROM public.profiles WHERE deleted_at IS NULL AND created_at > now() - interval '7 days') AS users_new_7d,
  (SELECT count(*) FROM public.groups WHERE deleted_at IS NULL AND status = 'active') AS groups_active,
  (SELECT count(*) FROM public.groups WHERE deleted_at IS NULL) AS groups_total,
  (SELECT count(*) FROM public.cycles WHERE ended_at IS NULL) AS cycles_open,
  (SELECT coalesce(sum(amount),0) FROM public.payments WHERE status='succeeded' AND settled_at > now() - interval '30 days') AS volume_30d,
  (SELECT count(*) FROM public.payments WHERE status='failed' AND initiated_at > now() - interval '7 days') AS payment_failures_7d,
  (SELECT count(*) FROM public.group_deletion_requests WHERE status IN ('pending_members','pending_admin')) AS deletion_requests_open,
  (SELECT coalesce(avg(reliability_score),0)::int FROM public.profiles WHERE deleted_at IS NULL) AS reliability_avg;

DROP VIEW IF EXISTS public.admin_user_overview;
CREATE VIEW public.admin_user_overview WITH (security_invoker=on) AS
SELECT
  p.id,
  p.full_name,
  p.phone_number,
  p.avatar_url,
  p.reliability_score,
  p.created_at,
  p.suspended_at,
  p.deleted_at,
  (SELECT array_agg(role::text) FROM public.user_roles WHERE user_id = p.id) AS roles,
  (SELECT count(*) FROM public.group_members WHERE user_id = p.id AND removed_at IS NULL) AS groups_count,
  u.email
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id;

DROP VIEW IF EXISTS public.admin_group_overview;
CREATE VIEW public.admin_group_overview WITH (security_invoker=on) AS
SELECT
  g.id,
  g.name,
  g.status,
  g.contribution_amount,
  g.frequency,
  g.max_members,
  g.created_at,
  g.created_by,
  g.deleted_at,
  g.paused_at,
  g.archived_at,
  (SELECT full_name FROM public.profiles WHERE id = g.created_by) AS organizer_name,
  (SELECT count(*) FROM public.group_members WHERE group_id = g.id AND removed_at IS NULL AND status='active') AS members_count,
  (SELECT coalesce(sum(amount),0) FROM public.payments WHERE group_id = g.id AND status='succeeded') AS volume_total
FROM public.groups g;

DROP VIEW IF EXISTS public.admin_payment_overview;
CREATE VIEW public.admin_payment_overview WITH (security_invoker=on) AS
SELECT
  pay.id,
  pay.group_id,
  pay.user_id,
  pay.amount,
  pay.status,
  pay.provider,
  pay.payment_method,
  pay.djomy_transaction_id,
  pay.error_message,
  pay.initiated_at,
  pay.settled_at,
  g.name AS group_name,
  pr.full_name AS payer_name
FROM public.payments pay
LEFT JOIN public.groups g ON g.id = pay.group_id
LEFT JOIN public.profiles pr ON pr.id = pay.user_id;

GRANT SELECT ON public.admin_platform_kpis TO authenticated;
GRANT SELECT ON public.admin_user_overview TO authenticated;
GRANT SELECT ON public.admin_group_overview TO authenticated;
GRANT SELECT ON public.admin_payment_overview TO authenticated;

-- 4) RPCs admin
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  _target_user uuid,
  _role public.app_role,
  _grant boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _grant THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_target_user, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _target_user AND role = _role;
  END IF;
  INSERT INTO public.audit_log(actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), CASE WHEN _grant THEN 'admin.role.grant' ELSE 'admin.role.revoke' END,
          'user', _target_user, jsonb_build_object('role', _role));
END $$;

CREATE OR REPLACE FUNCTION public.admin_suspend_user(
  _target_user uuid,
  _suspend boolean,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _suspend THEN
    UPDATE public.profiles
       SET suspended_at = now(), suspended_reason = _reason, suspended_by = auth.uid()
     WHERE id = _target_user;
  ELSE
    UPDATE public.profiles
       SET suspended_at = NULL, suspended_reason = NULL, suspended_by = NULL
     WHERE id = _target_user;
  END IF;
  INSERT INTO public.audit_log(actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), CASE WHEN _suspend THEN 'admin.user.suspend' ELSE 'admin.user.unsuspend' END,
          'user', _target_user, jsonb_build_object('reason', _reason));
END $$;

CREATE OR REPLACE FUNCTION public.admin_force_group_status(
  _group_id uuid,
  _action text,           -- 'pause' | 'resume' | 'archive'
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _action = 'pause' THEN
    UPDATE public.groups
       SET status='paused', paused_at=now(), paused_reason=_reason, paused_by=auth.uid()
     WHERE id = _group_id;
  ELSIF _action = 'resume' THEN
    UPDATE public.groups
       SET status='active', paused_at=NULL, paused_reason=NULL, paused_by=NULL
     WHERE id = _group_id;
  ELSIF _action = 'archive' THEN
    UPDATE public.groups
       SET archived_at=now(), archived_reason=_reason, archived_by=auth.uid()
     WHERE id = _group_id;
  ELSE
    RAISE EXCEPTION 'INVALID_ACTION';
  END IF;
  INSERT INTO public.audit_log(actor_user_id, group_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), _group_id, 'admin.group.' || _action, 'group', _group_id,
          jsonb_build_object('reason', _reason));
END $$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_force_group_status(uuid, text, text) TO authenticated;
