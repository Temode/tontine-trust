CREATE OR REPLACE FUNCTION public.can_join_call(p_call_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.call_requests cr
    JOIN public.group_members gm ON gm.group_id = cr.group_id
    WHERE cr.id = p_call_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.can_join_call(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_join_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_join_call(uuid) TO service_role;