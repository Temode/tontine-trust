CREATE OR REPLACE FUNCTION public.notification_target(_kind text, _link text, _group_id uuid, _data jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE g text := CASE WHEN _group_id IS NULL THEN NULL ELSE _group_id::text END;
BEGIN
  CASE _kind
    WHEN 'chat_message', 'call_missed' THEN RETURN COALESCE('/discussions/' || g, '/discussions');
    WHEN 'call_incoming' THEN RETURN COALESCE('/appel/' || (_data->>'call_id'), '/discussions/' || g, '/discussions');
    WHEN 'contribution_due', 'contribution_late', 'manual_reminder' THEN RETURN COALESCE('/groupes/' || g, '/cotisations');
    ELSE NULL;
  END CASE;
  IF _link IS NOT NULL AND _link LIKE '/%' THEN RETURN _link; END IF;
  RETURN CASE
    WHEN _kind IN ('invitation_accepted','member_joined') THEN COALESCE('/groupes/' || g || '/membres', '/groupes')
    WHEN _kind = 'invitation_received' THEN '/rejoindre'
    WHEN _kind IN ('contribution_received','contribution_confirmed') THEN '/cotisations'
    WHEN _kind IN ('payout_released','penalty_share_received','withdrawal_requested','withdrawal_processing','withdrawal_paid','withdrawal_failed','withdrawal_cancelled','payout_hold_released') THEN '/solde'
    WHEN _kind = 'receipt_ready' THEN '/recus'
    WHEN _kind = 'reliability_changed' THEN '/profil'
    WHEN g IS NOT NULL THEN '/groupes/' || g
    ELSE '/notifications'
  END;
END $$;
GRANT EXECUTE ON FUNCTION public.notification_target(text, text, uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enqueue_push_from_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM push_tokens WHERE user_id = NEW.user_id) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM notification_preferences WHERE user_id = NEW.user_id AND push_enabled = false) THEN RETURN NEW; END IF;
  INSERT INTO push_outbox(user_id, title, body, data)
  VALUES (NEW.user_id, NEW.title, NEW.body,
    jsonb_build_object(
      'notification_id', NEW.id::text,
      'kind', NEW.kind::text,
      'link', public.notification_target(NEW.kind::text, NEW.link, NEW.group_id, NEW.data),
      'collapse_key', CASE WHEN NEW.kind::text IN ('chat_message','call_incoming','call_missed')
                           THEN NEW.kind::text || ':' || COALESCE(NEW.group_id::text, '') ELSE NEW.id::text END));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE gname text; author text; preview text;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT name INTO gname FROM groups WHERE id = NEW.group_id;
  SELECT split_part(COALESCE(full_name, 'Un membre'), ' ', 1) INTO author FROM profiles WHERE id = NEW.author_user_id;
  preview := CASE WHEN COALESCE(btrim(NEW.body), '') = '' THEN 'a envoyé une pièce jointe'
                  ELSE left(NEW.body, 120) END;
  INSERT INTO notifications(user_id, kind, title, body, group_id, link, data)
  SELECT gm.user_id, 'chat_message', COALESCE(gname, 'Nouveau message'),
         COALESCE(author, 'Un membre') || ' : ' || preview, NEW.group_id,
         '/discussions/' || NEW.group_id, jsonb_build_object('message_id', NEW.id)
  FROM group_members gm
  WHERE gm.group_id = NEW.group_id AND gm.status = 'active' AND gm.user_id IS NOT NULL
    AND gm.user_id <> NEW.author_user_id
    AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = gm.user_id AND n.group_id = NEW.group_id
                    AND n.kind = 'chat_message' AND n.read_at IS NULL AND n.created_at > now() - interval '60 seconds');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_group_messages_notify ON public.group_messages;
CREATE TRIGGER trg_group_messages_notify AFTER INSERT ON public.group_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_chat_message();

CREATE OR REPLACE FUNCTION public.notify_call_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE gname text; caller text; k text; t text; b text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' AND (NEW.scheduled_at IS NULL OR NEW.scheduled_at <= now() + interval '1 minute') THEN
    k := 'call_incoming';
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'missed' AND OLD.status IS DISTINCT FROM 'missed' THEN
    k := 'call_missed';
  ELSE RETURN NEW; END IF;
  SELECT name INTO gname FROM groups WHERE id = NEW.group_id;
  SELECT COALESCE(full_name, 'Un membre') INTO caller FROM profiles WHERE id = NEW.requested_by;
  IF k = 'call_incoming' THEN t := 'Appel entrant · ' || COALESCE(gname, 'Tontine'); b := COALESCE(caller, 'Un membre') || ' vous appelle';
  ELSE t := 'Appel manqué · ' || COALESCE(gname, 'Tontine'); b := 'Appel de ' || COALESCE(caller, 'un membre'); END IF;
  INSERT INTO notifications(user_id, kind, title, body, group_id, data)
  SELECT gm.user_id, k::notification_kind, t, b, NEW.group_id, jsonb_build_object('call_id', NEW.id::text)
  FROM group_members gm
  WHERE gm.group_id = NEW.group_id AND gm.status = 'active' AND gm.user_id IS NOT NULL AND gm.user_id <> NEW.requested_by;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_call_requests_notify ON public.call_requests;
CREATE TRIGGER trg_call_requests_notify AFTER INSERT OR UPDATE OF status ON public.call_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_call_request();