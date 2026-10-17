CREATE OR REPLACE FUNCTION public.set_push_enabled(_enabled boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notification_preferences SET push_enabled = _enabled WHERE user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.set_push_enabled(boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_push_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM notification_preferences WHERE user_id = auth.uid() AND push_enabled = false);
$$;
GRANT EXECUTE ON FUNCTION public.get_push_enabled() TO authenticated;