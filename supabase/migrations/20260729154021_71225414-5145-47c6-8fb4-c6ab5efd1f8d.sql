
CREATE OR REPLACE FUNCTION public.expire_stale_call_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.call_requests
     SET status = 'missed'
   WHERE status = 'pending'
     AND created_at < now() - interval '2 minutes';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_call_requests() TO authenticated;

-- Nettoyage immédiat des appels fantômes déjà présents
SELECT public.expire_stale_call_requests();
