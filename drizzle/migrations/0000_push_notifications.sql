CREATE TABLE public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('android','ios','web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_tokens_user_idx ON public.push_tokens(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tokens select" ON public.push_tokens FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own tokens delete" ON public.push_tokens FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.push_outbox (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX push_outbox_pending_idx ON public.push_outbox(status, id);
GRANT ALL ON public.push_outbox TO service_role;
ALTER TABLE public.push_outbox ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.register_push_token(_token text, _platform text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _platform NOT IN ('android','ios','web') OR length(_token) < 10 THEN RAISE EXCEPTION 'INVALID_TOKEN'; END IF;
  INSERT INTO push_tokens(user_id, token, platform) VALUES (auth.uid(), _token, _platform)
  ON CONFLICT (token) DO UPDATE SET user_id = auth.uid(), platform = EXCLUDED.platform, last_seen = now();
END $$;
GRANT EXECUTE ON FUNCTION public.register_push_token(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_push_from_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM push_tokens WHERE user_id = NEW.user_id) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM notification_preferences WHERE user_id = NEW.user_id AND push_enabled = false) THEN RETURN NEW; END IF;
  INSERT INTO push_outbox(user_id, title, body, data)
  VALUES (NEW.user_id, NEW.title, NEW.body,
    jsonb_build_object('notification_id', NEW.id::text, 'link', COALESCE(to_jsonb(NEW)->>'link', '/notifications')));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
CREATE TRIGGER trg_notifications_push AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.enqueue_push_from_notification();

CREATE OR REPLACE FUNCTION public.push_outbox_pop(_limit int DEFAULT 50)
RETURNS SETOF public.push_outbox LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE push_outbox SET status = 'sending', attempts = attempts + 1
  WHERE id IN (SELECT id FROM push_outbox WHERE status = 'pending' OR (status='sending' AND attempts < 3 AND created_at < now() - interval '5 minutes')
               ORDER BY id LIMIT _limit FOR UPDATE SKIP LOCKED)
  RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.push_outbox_pop(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_outbox_pop(int) TO service_role;