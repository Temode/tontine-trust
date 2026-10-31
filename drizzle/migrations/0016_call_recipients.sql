CREATE TABLE public.call_recipients (
  call_id uuid NOT NULL REFERENCES public.call_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'ringing'
    CHECK (status IN ('ringing','delivered','declined','accepted','missed','unreachable','left')),
  delivered_at timestamptz,
  responded_at timestamptz,
  joined_late boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (call_id, user_id)
);
GRANT SELECT ON public.call_recipients TO authenticated;
GRANT ALL ON public.call_recipients TO service_role;
ALTER TABLE public.call_recipients ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_call(_call_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.call_requests cr
    WHERE cr.id = _call_id AND (cr.requested_by = _uid OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = cr.group_id AND gm.user_id = _uid AND gm.status = 'active')))
$$;

CREATE POLICY "Membres de la tontine lisent les destinataires"
ON public.call_recipients FOR SELECT TO authenticated
USING (public.can_view_call(call_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.call_recipients;

-- Seule porte d'écriture. Non exposée aux clients.
CREATE OR REPLACE FUNCTION public._call_recipient_set(p_call_id uuid, p_user_id uuid, p_status text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_call public.call_requests%ROWTYPE;
  v_cur text;
BEGIN
  IF p_status NOT IN ('delivered','declined','accepted','left') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  SELECT * INTO v_call FROM public.call_requests WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF p_user_id = v_call.requested_by THEN RETURN 'caller'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = v_call.group_id AND user_id = p_user_id AND status = 'active') THEN
    RAISE EXCEPTION 'NOT_A_MEMBER';
  END IF;
  SELECT status INTO v_cur FROM public.call_recipients WHERE call_id = p_call_id AND user_id = p_user_id FOR UPDATE;

  IF v_cur IS NULL THEN
    -- Arrivée hors instantané : seule l'entrée dans l'appel crée une ligne.
    IF p_status <> 'accepted' OR v_call.status NOT IN ('pending','accepted') THEN RETURN 'ignored'; END IF;
    INSERT INTO public.call_recipients (call_id, user_id, status, responded_at, joined_late)
    VALUES (p_call_id, p_user_id, 'accepted', now(), true);
  ELSIF p_status = 'delivered' THEN
    IF v_cur NOT IN ('ringing','unreachable') THEN RETURN v_cur; END IF;
    UPDATE public.call_recipients SET status = 'delivered', delivered_at = now(), updated_at = now()
     WHERE call_id = p_call_id AND user_id = p_user_id;
  ELSIF p_status = 'declined' THEN
    IF v_cur NOT IN ('ringing','delivered','unreachable') OR v_call.status NOT IN ('pending','accepted') THEN RETURN v_cur; END IF;
    UPDATE public.call_recipients SET status = 'declined', responded_at = now(), updated_at = now()
     WHERE call_id = p_call_id AND user_id = p_user_id;
  ELSIF p_status = 'accepted' THEN
    IF v_cur = 'accepted' OR v_call.status NOT IN ('pending','accepted') THEN RETURN v_cur; END IF;
    UPDATE public.call_recipients SET status = 'accepted', responded_at = now(), updated_at = now()
     WHERE call_id = p_call_id AND user_id = p_user_id;
  ELSIF p_status = 'left' THEN
    IF v_cur <> 'accepted' THEN RETURN v_cur; END IF;
    UPDATE public.call_recipients SET status = 'left', updated_at = now()
     WHERE call_id = p_call_id AND user_id = p_user_id;
  END IF;

  -- Statut global dérivé des lignes.
  IF p_status = 'accepted' AND v_call.status = 'pending' THEN
    UPDATE public.call_requests SET status = 'accepted', started_at = COALESCE(started_at, now()), updated_at = now()
     WHERE id = p_call_id;
  ELSIF p_status = 'declined' AND v_call.status = 'pending' AND NOT EXISTS (
    SELECT 1 FROM public.call_recipients WHERE call_id = p_call_id
       AND status IN ('ringing','delivered','unreachable','accepted')) THEN
    UPDATE public.call_requests SET status = 'declined', ended_at = COALESCE(ended_at, now()), updated_at = now()
     WHERE id = p_call_id;
  END IF;
  RETURN p_status;
END $$;
REVOKE ALL ON FUNCTION public._call_recipient_set(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._call_recipient_set(uuid, uuid, text) TO service_role;

-- Accusé de réception web : l'écran d'appel entrant s'est affiché.
CREATE OR REPLACE FUNCTION public.ack_call_delivered(p_call_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  PERFORM public._call_recipient_set(p_call_id, auth.uid(), 'delivered');
END $$;
REVOKE ALL ON FUNCTION public.ack_call_delivered(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ack_call_delivered(uuid) TO authenticated;

-- Instantané des destinataires au lancement.
CREATE OR REPLACE FUNCTION public.request_group_call(p_group_id uuid, p_topic text, p_scheduled_at timestamp with time zone)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and status = 'active'
  ) then raise exception 'NOT_A_MEMBER'; end if;
  insert into public.call_requests (group_id, requested_by, topic, scheduled_at)
  values (p_group_id, auth.uid(), nullif(trim(coalesce(p_topic,'')), ''), p_scheduled_at)
  returning id into v_id;
  insert into public.call_recipients (call_id, user_id, status)
  select v_id, gm.user_id,
         case when exists (select 1 from public.push_tokens pt where pt.user_id = gm.user_id) then 'ringing' else 'unreachable' end
    from public.group_members gm
   where gm.group_id = p_group_id and gm.status = 'active' and gm.user_id <> auth.uid()
  on conflict do nothing;
  return v_id;
end;
$function$;

-- Le destinataire passe par la même porte que le natif.
CREATE OR REPLACE FUNCTION public.respond_call_request(p_id uuid, p_status call_request_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_call public.call_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_call FROM public.call_requests WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = v_call.group_id AND user_id = auth.uid() AND status = 'active') THEN
    RAISE EXCEPTION 'NOT_A_MEMBER';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('accepted','declined','cancelled','missed','ended') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  IF auth.uid() <> v_call.requested_by AND p_status IN ('accepted','declined') THEN
    PERFORM public._call_recipient_set(p_id, auth.uid(), p_status::text);
    RETURN;
  END IF;
  SELECT * INTO v_call FROM public.call_requests WHERE id = p_id FOR UPDATE;
  IF v_call.status IN ('ended','declined','cancelled','missed') OR v_call.status = p_status THEN RETURN; END IF;
  IF p_status = 'missed' THEN
    IF auth.uid() <> v_call.requested_by THEN RAISE EXCEPTION 'NOT_THE_CALLER'; END IF;
    IF v_call.status <> 'pending' OR now() < COALESCE(v_call.scheduled_at, v_call.created_at) + interval '60 seconds' THEN RETURN; END IF;
  END IF;
  IF p_status = 'accepted' THEN RETURN; END IF;
  IF v_call.status = 'accepted' AND p_status <> 'ended' THEN RETURN; END IF;
  UPDATE public.call_requests SET status = p_status, updated_at = now(),
    ended_at = CASE WHEN p_status IN ('ended','cancelled','missed','declined') THEN COALESCE(ended_at, now()) ELSE ended_at END
  WHERE id = p_id;
END;
$function$;

-- Présence dans l'appel. L'appelant qui rejoint n'accepte pas son propre appel.
CREATE OR REPLACE FUNCTION public.join_call(p_call_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare v_call public.call_requests%ROWTYPE;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_call from public.call_requests where id = p_call_id;
  if not found then raise exception 'CALL_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.group_members
    where group_id = v_call.group_id and user_id = auth.uid() and status = 'active'
  ) then raise exception 'NOT_A_MEMBER'; end if;
  insert into public.call_participants (call_id, user_id, joined_at, left_at, is_muted, updated_at)
  values (p_call_id, auth.uid(), now(), null, false, now())
  on conflict (call_id, user_id) do update
    set joined_at = case when public.call_participants.left_at is not null then now() else public.call_participants.joined_at end,
        left_at = null, is_muted = false, updated_at = now();
  if auth.uid() <> v_call.requested_by then
    perform public._call_recipient_set(p_call_id, auth.uid(), 'accepted');
  end if;
  insert into public.user_call_presence (user_id, status, updated_at)
  values (auth.uid(), 'busy', now())
  on conflict (user_id) do update set status = 'busy', updated_at = now();
end;
$function$;

CREATE OR REPLACE FUNCTION public.leave_call(p_call_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.call_participants set left_at = now(), updated_at = now()
   where call_id = p_call_id and user_id = auth.uid() and left_at is null;
  if exists (select 1 from public.call_recipients where call_id = p_call_id and user_id = auth.uid()) then
    perform public._call_recipient_set(p_call_id, auth.uid(), 'left');
  end if;
  insert into public.user_call_presence (user_id, status, updated_at)
  values (auth.uid(), 'available', now())
  on conflict (user_id) do update set status = 'available', updated_at = now();
end;
$function$;

-- Fin d'appel : personne ne reste « sonne » ni « en ligne ».
CREATE OR REPLACE FUNCTION public.call_recipients_on_call_end()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('ended','cancelled','missed','declined') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.call_recipients SET status = 'missed', updated_at = now()
     WHERE call_id = NEW.id AND status IN ('ringing','delivered','unreachable');
    UPDATE public.call_recipients SET status = 'left', updated_at = now()
     WHERE call_id = NEW.id AND status = 'accepted';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_call_recipients_on_call_end
AFTER UPDATE OF status ON public.call_requests
FOR EACH ROW EXECUTE FUNCTION public.call_recipients_on_call_end();

-- Sonnerie individuelle limitée à 60 s, même si l'appel continue avec d'autres.
CREATE OR REPLACE FUNCTION public.expire_stale_call_requests()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_count integer;
BEGIN
  UPDATE public.call_recipients r SET status = 'missed', updated_at = now()
    FROM public.call_requests c
   WHERE c.id = r.call_id AND r.status IN ('ringing','delivered','unreachable')
     AND COALESCE(c.scheduled_at, c.created_at) < now() - interval '60 seconds';
  UPDATE public.call_requests SET status = 'missed', updated_at = now(), ended_at = COALESCE(ended_at, now())
  WHERE status = 'pending' AND COALESCE(scheduled_at, created_at) < now() - interval '90 seconds';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;