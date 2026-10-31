-- Suivi par destinataire : tout est annulé par la sous-transaction finale.
DO $test$
DECLARE
  g uuid; caller uuid; recipient uuid; ghost uuid := gen_random_uuid(); cid uuid;
  st public.call_request_status; rs text; late boolean; n int;
BEGIN
  SELECT a.group_id, a.user_id, b.user_id INTO g, caller, recipient
  FROM public.group_members a JOIN public.group_members b ON b.group_id = a.group_id
  JOIN auth.users pa ON pa.id = a.user_id JOIN auth.users pb ON pb.id = b.user_id
  WHERE a.status = 'active' AND b.status = 'active'
    AND pa.email = 'comptea@yopmail.com' AND pb.email = 'compteb@yopmail.com' LIMIT 1;
  ASSERT g IS NOT NULL, 'test accounts must share an active tontine';
  BEGIN
    -- 1. Instantané au lancement, sans l'appelant.
    PERFORM set_config('request.jwt.claim.sub', caller::text, true);
    cid := public.request_group_call(g, NULL, NULL);
    SELECT count(*) INTO n FROM public.call_recipients WHERE call_id = cid AND user_id = caller;
    ASSERT n = 0, 'caller is never a recipient';
    SELECT status INTO rs FROM public.call_recipients WHERE call_id = cid AND user_id = recipient;
    ASSERT rs IN ('ringing','unreachable'), 'recipient snapshot created at launch';

    -- 2. Un refus parmi plusieurs laisse l'appel en cours.
    INSERT INTO public.call_recipients(call_id, user_id, status) VALUES (cid, ghost, 'ringing');
    PERFORM public._call_recipient_set(cid, recipient, 'delivered');
    SELECT status INTO rs FROM public.call_recipients WHERE call_id = cid AND user_id = recipient;
    ASSERT rs = 'delivered', 'device acknowledgement recorded';
    PERFORM public._call_recipient_set(cid, recipient, 'declined');
    SELECT status INTO st FROM public.call_requests WHERE id = cid;
    ASSERT st = 'pending', 'one decline out of several keeps the call ringing';

    -- 3. Dernier refus : l'appel passe à refusé, et ne se rouvre jamais.
    UPDATE public.call_recipients SET status = 'declined' WHERE call_id = cid AND user_id = ghost;
    DELETE FROM public.call_recipients WHERE call_id = cid AND user_id = ghost;
    UPDATE public.call_recipients SET status = 'ringing' WHERE call_id = cid AND user_id = recipient;
    PERFORM public._call_recipient_set(cid, recipient, 'declined');
    SELECT status INTO st FROM public.call_requests WHERE id = cid;
    ASSERT st = 'declined', 'when everyone declined the call is declined';
    PERFORM public._call_recipient_set(cid, recipient, 'accepted');
    SELECT status INTO st FROM public.call_requests WHERE id = cid;
    ASSERT st = 'declined', 'a terminal call never reopens';

    -- 4. Arrivée hors instantané : ligne créée directement en accepted.
    PERFORM set_config('request.jwt.claim.sub', caller::text, true);
    cid := public.request_group_call(g, NULL, NULL);
    DELETE FROM public.call_recipients WHERE call_id = cid AND user_id = recipient;
    PERFORM set_config('request.jwt.claim.sub', recipient::text, true);
    PERFORM public.join_call(cid);
    SELECT status, joined_late INTO rs, late FROM public.call_recipients WHERE call_id = cid AND user_id = recipient;
    ASSERT rs = 'accepted' AND late, 'late joiner gets an accepted row';
    SELECT status INTO st FROM public.call_requests WHERE id = cid;
    ASSERT st = 'accepted', 'a recipient joining answers the call';

    -- 5. L'appelant qui rejoint sa salle ne décroche pas son propre appel.
    PERFORM set_config('request.jwt.claim.sub', caller::text, true);
    cid := public.request_group_call(g, NULL, NULL);
    PERFORM public.join_call(cid);
    SELECT status INTO st FROM public.call_requests WHERE id = cid;
    ASSERT st = 'pending', 'caller joining must not accept';

    -- 6. Un inconnu ne lit rien.
    ASSERT NOT public.can_view_call(cid, ghost), 'non-member cannot read recipients';

    RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'rollback successful test fixtures';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
END;
$test$;
