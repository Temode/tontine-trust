DO $$
DECLARE d text := pg_get_functiondef('public.enqueue_email_for_notification'::regproc);
BEGIN
  IF position('receipt_ready' in d) = 0 THEN
    d := replace(d, $x$IF v_email IS NULL OR v_email = '' THEN RETURN NEW; END IF;$x$,
      $x$IF v_email IS NULL OR v_email = '' THEN RETURN NEW; END IF;
  IF NEW.kind::text = 'receipt_ready' THEN RETURN NEW; END IF;$x$);
    EXECUTE d;
  END IF;
END $$;