-- Transactional integration regression: all calls and notification effects
-- are rolled back by the inner subtransaction, including on assertion failure.
DO $test$
DECLARE
  g uuid; caller uuid; recipient uuid; cid uuid;
  st public.call_request_status; started timestamptz; first_started timestamptz;
  finished timestamptz; first_finished timestamptz;
BEGIN
  SELECT a.group_id, a.user_id, b.user_id INTO g, caller, recipient
  FROM public.group_members a JOIN public.group_members b ON b.group_id = a.group_id
  JOIN public.profiles pa ON pa.id = a.user_id JOIN public.profiles pb ON pb.id = b.user_id
  WHERE a.status = 'active' AND b.status = 'active'
    AND pa.email = 'comptea@yopmail.com' AND pb.email = 'compteb@yopmail.com' LIMIT 1;
  ASSERT g IS NOT NULL, 'test accounts must share an active tontine';
  BEGIN
    INSERT INTO public.call_requests(group_id, requested_by, scheduled_at, created_at)
    VALUES(g, caller, now() + interval '1 day', now() - interval '61 seconds') RETURNING id INTO cid;
    PERFORM set_config('request.jwt.claim.sub', caller::text, true);
    PERFORM public.respond_call_request(cid, 'accepted');
    SELECT status INTO st FROM public.call_requests WHERE id = cid;
    ASSERT st = 'pending', 'caller connection must not acknowledge an answer';
    PERFORM public.respond_call_request(cid, 'missed');
    SELECT status INTO st FROM public.call_requests WHERE id = cid;
    ASSERT st = 'pending', 'scheduled calls must not expire before their ringing window';
    UPDATE public.call_requests SET scheduled_at = NULL WHERE id = cid;
    PERFORM set_config('request.jwt.claim.sub', recipient::text, true);
    PERFORM public.respond_call_request(cid, 'accepted');
    SELECT status, started_at INTO st, first_started FROM public.call_requests WHERE id = cid;
    ASSERT st = 'accepted' AND first_started IS NOT NULL, 'recipient answer must be acknowledged';
    PERFORM public.respond_call_request(cid, 'accepted');
    SELECT started_at INTO started FROM public.call_requests WHERE id = cid;
    ASSERT started = first_started, 'duplicate accepted must preserve started_at';
    PERFORM set_config('request.jwt.claim.sub', caller::text, true);
    PERFORM public.respond_call_request(cid, 'missed');
    PERFORM public.respond_call_request(cid, 'cancelled');
    PERFORM public.respond_call_request(cid, 'declined');
    SELECT status INTO st FROM public.call_requests WHERE id = cid;
    ASSERT st = 'accepted', 'late timeout or rejection must not overwrite accepted';
    PERFORM public.respond_call_request(cid, 'ended');
    SELECT ended_at INTO first_finished FROM public.call_requests WHERE id = cid;
    PERFORM set_config('request.jwt.claim.sub', recipient::text, true);
    PERFORM public.respond_call_request(cid, 'accepted');
    PERFORM public.respond_call_request(cid, 'ended');
    SELECT status, ended_at INTO st, finished FROM public.call_requests WHERE id = cid;
    ASSERT st = 'ended' AND finished = first_finished, 'late accepted must never reopen ended';
    INSERT INTO public.call_requests(group_id, requested_by, scheduled_at, created_at)
    VALUES(g, caller, now() + interval '1 day', now()) RETURNING id INTO cid;
    UPDATE public.call_requests SET scheduled_at = NULL WHERE id = cid;
    PERFORM set_config('request.jwt.claim.sub', caller::text, true);
    PERFORM public.respond_call_request(cid, 'missed');
    SELECT status INTO st FROM public.call_requests WHERE id = cid;
    ASSERT st = 'pending', 'caller must not expire before 60 seconds';
    UPDATE public.call_requests SET created_at = now() - interval '60 seconds' WHERE id = cid;
    PERFORM public.respond_call_request(cid, 'missed');
    SELECT status, ended_at INTO st, finished FROM public.call_requests WHERE id = cid;
    ASSERT st = 'missed' AND finished IS NOT NULL, 'caller must expire at 60 seconds';
    INSERT INTO public.call_requests(group_id, requested_by, scheduled_at, created_at)
    VALUES(g, caller, now() + interval '1 day', now() - interval '89 seconds') RETURNING id INTO cid;
    UPDATE public.call_requests SET scheduled_at = NULL WHERE id = cid;
    PERFORM public.expire_stale_call_requests();
    SELECT status INTO st FROM public.call_requests WHERE id = cid;
    ASSERT st = 'pending', 'server fallback must not expire at 89 seconds';
    UPDATE public.call_requests SET created_at = now() - interval '91 seconds' WHERE id = cid;
    PERFORM public.expire_stale_call_requests();
    SELECT status, ended_at INTO st, finished FROM public.call_requests WHERE id = cid;
    ASSERT st = 'missed' AND finished IS NOT NULL, 'server fallback must expire after 90 seconds';
    RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'rollback successful test fixtures';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
END;
$test$;