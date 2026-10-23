
ALTER TABLE public.call_requests
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- Peut modérer : organisateur du groupe OU initiateur de l'appel
CREATE OR REPLACE FUNCTION public.can_moderate_call(p_call_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.call_requests cr
    WHERE cr.id = p_call_id
      AND (
        cr.requested_by = auth.uid()
        OR public.is_group_organizer(cr.group_id, auth.uid())
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_moderate_call(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_moderate_call(uuid) TO authenticated, service_role;

-- Contexte complet pour livekit-token
CREATE OR REPLACE FUNCTION public.get_call_context(p_call_id uuid)
RETURNS TABLE(allowed boolean, is_host boolean, locked boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = cr.group_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
    ) AS allowed,
    (
      cr.requested_by = auth.uid()
      OR public.is_group_organizer(cr.group_id, auth.uid())
    ) AS is_host,
    cr.is_locked AS locked
  FROM public.call_requests cr
  WHERE cr.id = p_call_id;
$$;

REVOKE ALL ON FUNCTION public.get_call_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_call_context(uuid) TO authenticated, service_role;

-- Toggle du verrou par un modérateur
CREATE OR REPLACE FUNCTION public.set_call_lock(p_call_id uuid, p_locked boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_moderate_call(p_call_id) THEN
    RAISE EXCEPTION 'Non autorisé à modérer cet appel' USING ERRCODE = '42501';
  END IF;
  UPDATE public.call_requests
    SET is_locked = p_locked
    WHERE id = p_call_id;
  RETURN p_locked;
END;
$$;

REVOKE ALL ON FUNCTION public.set_call_lock(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_call_lock(uuid, boolean) TO authenticated, service_role;
