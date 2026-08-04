CREATE OR REPLACE FUNCTION public._audit_confirm_test_user(_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF _email !~ '\.audit\+.*@tontine\.test$' THEN
    RAISE EXCEPTION 'AUDIT_EMAIL_PATTERN_ONLY';
  END IF;
  UPDATE auth.users
     SET email_confirmed_at = COALESCE(email_confirmed_at, now())
   WHERE email = _email;
END;
$$;