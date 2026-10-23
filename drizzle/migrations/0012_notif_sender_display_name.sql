CREATE OR REPLACE FUNCTION public.member_display_name(_name text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN _name IS NULL OR btrim(_name) = '' OR position('@' in _name) > 0 THEN 'Un membre' ELSE btrim(_name) END
$$;

CREATE OR REPLACE FUNCTION public.notify_chat_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE gname text; author text; preview text;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT name INTO gname FROM groups WHERE id = NEW.group_id;
  SELECT public.member_display_name(full_name) INTO author FROM profiles WHERE id = NEW.author_user_id;
  IF author IS DISTINCT FROM 'Un membre' THEN author := split_part(author, ' ', 1); END IF;
  preview := CASE WHEN COALESCE(btrim(NEW.body), '') = '' THEN 'a envoyé une pièce jointe' ELSE left(NEW.body, 120) END;
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
END $function$;

CREATE OR REPLACE FUNCTION public.notify_call_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE gname text; caller text; k text; t text; b text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' AND (NEW.scheduled_at IS NULL OR NEW.scheduled_at <= now() + interval '1 minute') THEN
    k := 'call_incoming';
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'missed' AND OLD.status IS DISTINCT FROM 'missed' THEN
    k := 'call_missed';
  ELSE RETURN NEW; END IF;
  SELECT name INTO gname FROM groups WHERE id = NEW.group_id;
  SELECT public.member_display_name(full_name) INTO caller FROM profiles WHERE id = NEW.requested_by;
  caller := COALESCE(caller, 'Un membre');
  IF k = 'call_incoming' THEN t := 'Appel entrant · ' || COALESCE(gname, 'Tontine'); b := caller || ' vous appelle';
  ELSE t := 'Appel manqué · ' || COALESCE(gname, 'Tontine'); b := 'Appel de ' || CASE WHEN caller = 'Un membre' THEN 'un membre' ELSE caller END; END IF;
  INSERT INTO notifications(user_id, kind, title, body, group_id, data)
  SELECT gm.user_id, k::notification_kind, t, b, NEW.group_id, jsonb_build_object('call_id', NEW.id::text)
  FROM group_members gm
  WHERE gm.group_id = NEW.group_id AND gm.status = 'active' AND gm.user_id IS NOT NULL AND gm.user_id <> NEW.requested_by;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $function$;