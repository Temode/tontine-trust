CREATE OR REPLACE FUNCTION public.enqueue_push_from_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM push_tokens WHERE user_id = NEW.user_id) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM notification_preferences WHERE user_id = NEW.user_id AND push_enabled = false) THEN RETURN NEW; END IF;
  INSERT INTO push_outbox(user_id, title, body, data)
  VALUES (NEW.user_id, NEW.title, NEW.body,
    jsonb_strip_nulls(jsonb_build_object(
      'notification_id', NEW.id::text,
      'kind', NEW.kind::text,
      'call_id', NEW.data->>'call_id',
      'link', public.notification_target(NEW.kind::text, NEW.link, NEW.group_id, NEW.data),
      'collapse_key', CASE WHEN NEW.kind::text IN ('chat_message','call_incoming','call_missed')
                           THEN NEW.kind::text || ':' || COALESCE(NEW.group_id::text, '') ELSE NEW.id::text END)));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.enqueue_call_cancel_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IS DISTINCT FROM 'pending' THEN
    INSERT INTO push_outbox(user_id, title, body, data)
    SELECT gm.user_id, 'call_cancel', NULL, jsonb_build_object('kind','call_cancel','call_id', NEW.id::text)
    FROM group_members gm
    WHERE gm.group_id = NEW.group_id AND gm.status = 'active' AND gm.user_id IS NOT NULL
      AND gm.user_id <> NEW.requested_by
      AND EXISTS (SELECT 1 FROM push_tokens pt WHERE pt.user_id = gm.user_id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_call_requests_cancel_push ON public.call_requests;
CREATE TRIGGER trg_call_requests_cancel_push AFTER UPDATE OF status ON public.call_requests
FOR EACH ROW EXECUTE FUNCTION public.enqueue_call_cancel_push();