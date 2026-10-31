CREATE OR REPLACE FUNCTION public.respond_call_request(p_id uuid, p_status public.call_request_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_call public.call_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_call FROM public.call_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = v_call.group_id AND user_id = auth.uid() AND status = 'active') THEN
    RAISE EXCEPTION 'NOT_A_MEMBER';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('accepted','declined','cancelled','missed','ended') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  -- Terminal states are immutable; duplicate acknowledgements preserve timestamps.
  IF v_call.status IN ('ended','declined','cancelled','missed') OR v_call.status = p_status THEN RETURN; END IF;
  -- Only the caller may expire ringing. Its room connection is not an answer.
  IF p_status = 'missed' THEN
    IF auth.uid() <> v_call.requested_by THEN RAISE EXCEPTION 'NOT_THE_CALLER'; END IF;
    IF v_call.status <> 'pending' OR now() < COALESCE(v_call.scheduled_at, v_call.created_at) + interval '60 seconds' THEN RETURN; END IF;
  END IF;
  IF p_status = 'accepted' AND auth.uid() = v_call.requested_by THEN RETURN; END IF;
  -- A late rejection/cancellation/timeout must not overwrite an answered call.
  IF v_call.status = 'accepted' AND p_status <> 'ended' THEN RETURN; END IF;
  UPDATE public.call_requests SET status = p_status, updated_at = now(),
    started_at = CASE WHEN p_status = 'accepted' THEN COALESCE(started_at, now()) ELSE started_at END,
    ended_at = CASE WHEN p_status IN ('ended','cancelled','missed','declined') THEN COALESCE(ended_at, now()) ELSE ended_at END
  WHERE id = p_id;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.respond_call_request(uuid, public.call_request_status) TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_stale_call_requests()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  UPDATE public.call_requests SET status = 'missed', updated_at = now(), ended_at = COALESCE(ended_at, now())
  WHERE status = 'pending' AND COALESCE(scheduled_at, created_at) < now() - interval '90 seconds';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.expire_stale_call_requests() TO authenticated;