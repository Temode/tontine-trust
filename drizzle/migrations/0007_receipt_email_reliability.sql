-- Reçus prioritaires dans la file
CREATE OR REPLACE FUNCTION public.email_outbox_pop(_limit integer DEFAULT 20)
 RETURNS SETOF email_outbox LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  with cte as (
    select id from public.email_outbox
     where ((status = 'queued' and next_attempt_at <= now())
        or (status = 'failed' and attempts < 8 and public.email_error_is_retryable(last_error) and next_attempt_at <= now())
        or (status = 'processing' and coalesce(locked_at, created_at) < now() - interval '10 minutes'))
     order by (dedupe_key like 'receipt:%') desc, created_at
     limit greatest(_limit, 1)
     for update skip locked)
  update public.email_outbox o set status='processing', attempts=o.attempts+1, locked_at=now()
    from cte where o.id = cte.id returning o.*;
$function$;

-- Quota quotidien atteint : on replanifie au lendemain sans consommer de tentative
CREATE OR REPLACE FUNCTION public.email_outbox_mark(_id uuid, _status text, _error text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF _status <> 'sent' AND _error ILIKE '%daily_quota%' THEN
    UPDATE public.email_outbox SET status='queued', last_error=_error, processed_at=now(), locked_at=null,
      attempts=greatest(attempts-1,0),
      next_attempt_at=date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' + interval '1 day 5 minutes'
     WHERE id=_id;
    RETURN;
  END IF;
  UPDATE public.email_outbox SET status=_status, last_error=_error, processed_at=now(), locked_at=null,
    next_attempt_at = CASE WHEN _status='sent' THEN next_attempt_at
      ELSE now() + make_interval(secs => least(3600, 60*power(2, greatest(attempts-1,0))::int)) END
   WHERE id=_id;
END $function$;

-- Statut d'envoi des reçus du membre
CREATE OR REPLACE FUNCTION public.get_my_receipt_email_status()
 RETURNS TABLE(receipt_id uuid, status text, sent_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, coalesce(e.status,'none'), CASE WHEN e.status='sent' THEN e.processed_at END
  FROM public.payment_receipts r
  LEFT JOIN public.email_outbox e ON e.dedupe_key = 'receipt:' || r.id::text
  WHERE r.user_id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_receipt_email_status() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_receipt_email_status() TO authenticated;

-- Renvoi par le membre (au plus une fois toutes les 10 minutes)
CREATE OR REPLACE FUNCTION public.resend_my_receipt(_receipt_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_row public.email_outbox;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.payment_receipts WHERE id=_receipt_id AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  SELECT * INTO v_row FROM public.email_outbox WHERE dedupe_key='receipt:'||_receipt_id::text;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_email_on_file'; END IF;
  IF v_row.status IN ('queued','processing') THEN RETURN 'pending'; END IF;
  IF v_row.processed_at > now() - interval '10 minutes' THEN RAISE EXCEPTION 'too_soon'; END IF;
  UPDATE public.email_outbox SET status='queued', attempts=0, next_attempt_at=now(), last_error=null WHERE id=v_row.id;
  RETURN 'queued';
END $$;
REVOKE EXECUTE ON FUNCTION public.resend_my_receipt(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.resend_my_receipt(uuid) TO authenticated;

-- Alerte Ops : reçu non envoyé depuis plus d'une heure
CREATE OR REPLACE FUNCTION public.check_unsent_receipts()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.email_outbox
   WHERE dedupe_key LIKE 'receipt:%' AND status <> 'sent' AND created_at < now() - interval '1 hour';
  IF n > 0 THEN
    INSERT INTO public.ops_alerts(code, severity, message, context, dedupe_key)
    VALUES ('receipt_email_unsent','warning', n || ' reçu(s) de paiement non envoyé(s) par email depuis plus d''une heure',
      jsonb_build_object('count', n), 'receipt_email_unsent:' || to_char(now(),'YYYYMMDDHH24'))
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.check_unsent_receipts() FROM anon, public, authenticated;
SELECT cron.unschedule('check-unsent-receipts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='check-unsent-receipts');
SELECT cron.schedule('check-unsent-receipts', '15 * * * *', 'SELECT public.check_unsent_receipts()');

-- Éviter le doublon : la notification receipt_ready n'envoie pas d'email générique (le reçu détaillé part déjà)
CREATE OR REPLACE FUNCTION public.enqueue_email_skip_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
DROP FUNCTION public.enqueue_email_skip_receipt_guard();

-- Remettre en file les emails bloqués par le quota
UPDATE public.email_outbox SET status='queued', attempts=0, next_attempt_at=now()
 WHERE status='failed' AND last_error ILIKE '%daily_quota%';