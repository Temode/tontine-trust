
CREATE TABLE IF NOT EXISTS public._email_trigger_debug (
  ts timestamptz default now(),
  step text,
  info jsonb
);
GRANT ALL ON public._email_trigger_debug TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_email_for_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_email text;
  v_name text;
  v_email_enabled boolean;
BEGIN
  INSERT INTO public._email_trigger_debug(step, info) VALUES ('start', jsonb_build_object('notif_id', NEW.id, 'user_id', NEW.user_id, 'kind', NEW.kind::text));

  SELECT au.email, coalesce(p.full_name, split_part(au.email, '@', 1))
    INTO v_email, v_name
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
   WHERE au.id = NEW.user_id;

  INSERT INTO public._email_trigger_debug(step, info) VALUES ('after_user_lookup', jsonb_build_object('email', v_email, 'name', v_name));

  IF v_email IS NULL OR v_email = '' THEN RETURN NEW; END IF;

  INSERT INTO public.email_outbox (kind, payload, dedupe_key)
  VALUES ('notification',
    jsonb_build_object('to', v_email, 'subject', NEW.title, 'html', '<p>'||coalesce(NEW.body,'')||'</p>', 'text', coalesce(NEW.body,''), 'notification_id', NEW.id),
    'notif:' || NEW.id::text)
  ON CONFLICT (dedupe_key) DO NOTHING;

  INSERT INTO public._email_trigger_debug(step, info) VALUES ('after_enqueue', jsonb_build_object('notif_id', NEW.id));
  RETURN NEW;
END;
$$;
