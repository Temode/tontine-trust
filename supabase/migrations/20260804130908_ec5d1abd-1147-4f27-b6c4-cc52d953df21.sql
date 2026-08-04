-- 1) Suivi de remise par canal ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('in_app','email','sms')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, channel)
);

GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own notification deliveries" ON public.notification_deliveries;
CREATE POLICY "own notification deliveries" ON public.notification_deliveries
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notif_deliv_notif ON public.notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS idx_notif_deliv_user ON public.notification_deliveries(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_notification_delivery()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_notification_delivery ON public.notification_deliveries;
CREATE TRIGGER trg_touch_notification_delivery
  BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.touch_notification_delivery();

CREATE OR REPLACE FUNCTION public.record_notification_delivery(
  _notification_id uuid, _user_id uuid, _channel text, _status text, _error text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notification_deliveries (notification_id, user_id, channel, status, attempts, last_error, acknowledged_at)
  VALUES (_notification_id, _user_id, _channel, _status,
          CASE WHEN _status = 'pending' THEN 0 ELSE 1 END, _error,
          CASE WHEN _status = 'sent' THEN now() END)
  ON CONFLICT (notification_id, channel) DO UPDATE
     SET status = EXCLUDED.status,
         attempts = public.notification_deliveries.attempts + 1,
         last_error = EXCLUDED.last_error,
         acknowledged_at = CASE WHEN EXCLUDED.status = 'sent' THEN now()
                                ELSE public.notification_deliveries.acknowledged_at END;
END $$;

REVOKE ALL ON FUNCTION public.record_notification_delivery(uuid, uuid, text, text, text) FROM public;

-- 2) Envoi SMS conditionné au forfait -----------------------------------------
CREATE OR REPLACE FUNCTION public.try_send_notification_sms(
  _notification_id uuid, _user_id uuid, _title text, _body text, _group_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub public.user_subscriptions;
  v_phone text; v_bal int; v_new int;
BEGIN
  SELECT * INTO v_sub FROM public.user_subscriptions
   WHERE user_id = _user_id ORDER BY updated_at DESC LIMIT 1;

  IF NOT FOUND OR v_sub.status NOT IN ('active','trialing')
     OR v_sub.plan_code NOT IN ('premium','business') THEN
    PERFORM public.record_notification_delivery(_notification_id, _user_id, 'sms', 'skipped', 'plan_free');
    RETURN false;
  END IF;

  SELECT phone_number INTO v_phone FROM public.profiles WHERE id = _user_id;
  SELECT balance_remaining INTO v_bal FROM public.sms_wallets WHERE user_id = _user_id;

  IF v_phone IS NULL OR length(trim(v_phone)) < 6 THEN
    PERFORM public.record_notification_delivery(_notification_id, _user_id, 'sms', 'skipped', 'no_phone');
    RETURN false;
  END IF;
  IF v_bal IS NULL OR v_bal <= 0 THEN
    PERFORM public.record_notification_delivery(_notification_id, _user_id, 'sms', 'skipped', 'wallet_empty');
    RETURN false;
  END IF;

  v_new := public.sms_wallet_debit(_user_id, 1, 'consumption'::public.sms_ledger_reason, _notification_id,
             jsonb_build_object('group_id', _group_id, 'source', 'notification'));
  IF v_new IS NULL THEN
    PERFORM public.record_notification_delivery(_notification_id, _user_id, 'sms', 'skipped', 'debit_failed');
    RETURN false;
  END IF;

  INSERT INTO public.sms_outbox(kind, payload, dedupe_key, status)
  VALUES ('system',
    jsonb_build_object('user_id', _user_id, 'phone', v_phone, 'title', _title,
      'body', coalesce(_body, _title), 'group_id', _group_id, 'notification_id', _notification_id),
    format('notif:sms:%s', _notification_id::text), 'pending')
  ON CONFLICT (dedupe_key) DO NOTHING;

  PERFORM public.record_notification_delivery(_notification_id, _user_id, 'sms', 'sent', NULL);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.try_send_notification_sms(uuid, uuid, text, text, uuid) FROM public;

-- 3) Dispatch multi-canal pour la relance -------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_renewal_notification(
  _user_id uuid, _title text, _body text, _group_id uuid, _cycle_id uuid, _reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res jsonb; v_notif uuid;
BEGIN
  v_res := public.dispatch_notification(
    _user_id, 'system'::public.notification_kind, _title, _body,
    jsonb_build_object('group_id', _group_id, 'cycle_id', _cycle_id, 'reason', _reason),
    _group_id, '/groupes/' || _group_id);
  v_notif := (v_res ->> 'notification_id')::uuid;

  PERFORM public.record_notification_delivery(v_notif, _user_id, 'in_app', 'sent', NULL);
  PERFORM public.try_send_notification_sms(v_notif, _user_id, _title, _body, _group_id);
  RETURN v_notif;
END $$;

REVOKE ALL ON FUNCTION public.dispatch_renewal_notification(uuid, text, text, uuid, uuid, text) FROM public;

-- 4) Accusé de réception email + relance en cas d'échec définitif --------------
CREATE OR REPLACE FUNCTION public.sync_email_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_notif uuid; v_user uuid; v_status text; v_final boolean := false;
  v_title text; v_body text; v_group uuid; v_sms boolean;
BEGIN
  IF NEW.kind <> 'notification' THEN RETURN NEW; END IF;
  v_notif := nullif(NEW.payload ->> 'notification_id','')::uuid;
  v_user  := nullif(NEW.payload ->> 'user_id','')::uuid;
  IF v_notif IS NULL OR v_user IS NULL THEN RETURN NEW; END IF;

  v_status := CASE
    WHEN NEW.status = 'sent' THEN 'sent'
    WHEN NEW.status IN ('failed','dead') AND NEW.attempts >= 8 THEN 'failed'
    WHEN NEW.status IN ('failed','dead') THEN 'pending'
    ELSE 'pending' END;

  v_final := (v_status = 'failed');
  PERFORM public.record_notification_delivery(v_notif, v_user, 'email', v_status, NEW.last_error);

  IF v_final THEN
    SELECT n.title, n.body, n.group_id INTO v_title, v_body, v_group
      FROM public.notifications n WHERE n.id = v_notif;
    IF v_title IS NOT NULL THEN
      v_sms := public.try_send_notification_sms(v_notif, v_user, v_title, v_body, v_group);
      IF NOT v_sms THEN
        INSERT INTO public.notifications(user_id, kind, title, body, group_id, data, link)
        VALUES (v_user, 'system'::public.notification_kind,
                'Rappel : ' || v_title,
                coalesce(v_body, '') || E'\n\n(Nous n''avons pas pu vous joindre par email.)',
                v_group,
                jsonb_build_object('reason','email_failed_fallback','source_notification_id', v_notif),
                '/notifications');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_email_delivery ON public.email_outbox;
CREATE TRIGGER trg_sync_email_delivery
  AFTER INSERT OR UPDATE OF status ON public.email_outbox
  FOR EACH ROW EXECUTE FUNCTION public.sync_email_delivery();

-- 5) Les RPC de relance utilisent le dispatch multi-canal ----------------------
CREATE OR REPLACE FUNCTION public.open_cycle_renewal(
  _group_id uuid, _min_members int, _deadline timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cycle public.cycles%ROWTYPE;
  v_active int;
  r RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_group_organizer(_group_id, v_uid) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT * INTO v_cycle FROM public.cycles
   WHERE group_id = _group_id ORDER BY cycle_number DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_CYCLE'; END IF;

  IF EXISTS (SELECT 1 FROM public.turns t
             WHERE t.cycle_id = v_cycle.id AND t.status <> 'paid' AND t.status <> 'skipped') THEN
    RAISE EXCEPTION 'CYCLE_NOT_FINISHED';
  END IF;
  IF v_cycle.awaiting_renewal AND v_cycle.renewal_closed_at IS NULL THEN
    RAISE EXCEPTION 'RENEWAL_ALREADY_OPEN';
  END IF;

  SELECT count(*) INTO v_active FROM public.group_members
   WHERE group_id = _group_id AND status = 'active';
  IF _min_members < 2 THEN RAISE EXCEPTION 'MIN_MEMBERS_TOO_LOW'; END IF;
  IF _min_members > v_active THEN RAISE EXCEPTION 'MIN_MEMBERS_TOO_HIGH'; END IF;
  IF _deadline <= now() THEN RAISE EXCEPTION 'DEADLINE_IN_PAST'; END IF;

  DELETE FROM public.cycle_renewal_votes WHERE cycle_id = v_cycle.id;

  UPDATE public.cycles
     SET awaiting_renewal = true,
         renewal_min_members = _min_members,
         renewal_deadline = _deadline,
         renewal_opened_at = now(),
         renewal_closed_at = NULL,
         renewal_threshold_notified_at = NULL,
         renewal_expiry_notified_at = NULL
   WHERE id = v_cycle.id;

  INSERT INTO public.cycle_renewal_votes (cycle_id, user_id, agreed, voted_at)
  VALUES (v_cycle.id, v_uid, true, now())
  ON CONFLICT (cycle_id, user_id) DO UPDATE SET agreed = true, voted_at = now();

  FOR r IN SELECT gm.user_id FROM public.group_members gm
            WHERE gm.group_id = _group_id AND gm.status = 'active' AND gm.user_id <> v_uid
  LOOP
    PERFORM public.dispatch_renewal_notification(
      r.user_id, 'Nouveau cycle proposé',
      'L''organisateur propose de relancer la tontine. Confirmez votre participation avant le '
        || to_char(_deadline, 'DD/MM/YYYY') || '.',
      _group_id, v_cycle.id, 'renewal_open');
  END LOOP;

  RETURN v_cycle.id;
END $$;

REVOKE ALL ON FUNCTION public.open_cycle_renewal(uuid, int, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.open_cycle_renewal(uuid, int, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.extend_cycle_renewal(
  _cycle_id uuid, _deadline timestamptz, _min_members int DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_group uuid; r RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT group_id INTO v_group FROM public.cycles WHERE id = _cycle_id;
  IF v_group IS NULL THEN RAISE EXCEPTION 'NO_CYCLE'; END IF;
  IF NOT public.is_group_organizer(v_group, v_uid) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _deadline <= now() THEN RAISE EXCEPTION 'DEADLINE_IN_PAST'; END IF;
  IF _min_members IS NOT NULL AND _min_members < 2 THEN RAISE EXCEPTION 'MIN_MEMBERS_TOO_LOW'; END IF;

  UPDATE public.cycles
     SET renewal_deadline = _deadline,
         renewal_min_members = coalesce(_min_members, renewal_min_members),
         renewal_expiry_notified_at = NULL,
         renewal_threshold_notified_at = NULL
   WHERE id = _cycle_id;

  FOR r IN SELECT gm.user_id FROM public.group_members gm
            WHERE gm.group_id = v_group AND gm.status = 'active' AND gm.user_id <> v_uid
              AND NOT EXISTS (SELECT 1 FROM public.cycle_renewal_votes v
                              WHERE v.cycle_id = _cycle_id AND v.user_id = gm.user_id)
  LOOP
    PERFORM public.dispatch_renewal_notification(
      r.user_id, 'Délai prolongé',
      'Vous avez jusqu''au ' || to_char(_deadline, 'DD/MM/YYYY')
        || ' pour confirmer votre participation au prochain cycle.',
      v_group, _cycle_id, 'renewal_extended');
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.extend_cycle_renewal(uuid, timestamptz, int) FROM public;
GRANT EXECUTE ON FUNCTION public.extend_cycle_renewal(uuid, timestamptz, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_cycle_renewal(_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_group uuid; v_cycle public.cycles%ROWTYPE; r RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_cycle FROM public.cycles WHERE id = _cycle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_CYCLE'; END IF;
  v_group := v_cycle.group_id;
  IF NOT public.is_group_organizer(v_group, v_uid) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT v_cycle.awaiting_renewal OR v_cycle.renewal_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'RENEWAL_NOT_OPEN';
  END IF;

  UPDATE public.cycles
     SET awaiting_renewal = false, renewal_closed_at = now()
   WHERE id = _cycle_id;

  FOR r IN SELECT gm.user_id FROM public.group_members gm
            WHERE gm.group_id = v_group AND gm.status = 'active' AND gm.user_id <> v_uid
  LOOP
    PERFORM public.dispatch_renewal_notification(
      r.user_id, 'Relance annulée',
      'La proposition de nouveau cycle a été annulée par l''organisateur. Aucun engagement n''est retenu.',
      v_group, _cycle_id, 'renewal_cancelled');
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.cancel_cycle_renewal(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_cycle_renewal(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.vote_cycle_renewal(_cycle_id uuid, _agreed boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cycle public.cycles%ROWTYPE;
  v_org uuid;
  v_accepted int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_cycle FROM public.cycles WHERE id = _cycle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_CYCLE'; END IF;
  IF NOT public.is_group_member(v_cycle.group_id, v_uid) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT v_cycle.awaiting_renewal OR v_cycle.renewal_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'RENEWAL_NOT_OPEN';
  END IF;
  IF v_cycle.renewal_deadline IS NOT NULL AND v_cycle.renewal_deadline < now() THEN
    RAISE EXCEPTION 'RENEWAL_DEADLINE_PASSED';
  END IF;

  INSERT INTO public.cycle_renewal_votes (cycle_id, user_id, agreed, voted_at)
  VALUES (_cycle_id, v_uid, _agreed, now())
  ON CONFLICT (cycle_id, user_id) DO UPDATE SET agreed = EXCLUDED.agreed, voted_at = now();

  SELECT count(*) INTO v_accepted
    FROM public.cycle_renewal_votes v
    JOIN public.group_members gm
      ON gm.user_id = v.user_id AND gm.group_id = v_cycle.group_id AND gm.status = 'active'
   WHERE v.cycle_id = _cycle_id AND v.agreed;

  IF v_cycle.renewal_min_members IS NOT NULL
     AND v_accepted >= v_cycle.renewal_min_members
     AND v_cycle.renewal_threshold_notified_at IS NULL THEN
    UPDATE public.cycles SET renewal_threshold_notified_at = now() WHERE id = _cycle_id;
    SELECT created_by INTO v_org FROM public.groups WHERE id = v_cycle.group_id;
    PERFORM public.dispatch_renewal_notification(
      v_org, 'Seuil atteint',
      v_accepted || ' membres ont confirmé leur participation. Vous pouvez démarrer le nouveau cycle.',
      v_cycle.group_id, _cycle_id, 'renewal_threshold');
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.vote_cycle_renewal(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.vote_cycle_renewal(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_expired_renewals()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_n int := 0; v_accepted int;
BEGIN
  FOR r IN
    SELECT c.id, c.group_id, c.renewal_min_members, g.created_by
      FROM public.cycles c JOIN public.groups g ON g.id = c.group_id
     WHERE c.awaiting_renewal AND c.renewal_closed_at IS NULL
       AND c.renewal_deadline IS NOT NULL AND c.renewal_deadline < now()
       AND c.renewal_expiry_notified_at IS NULL
  LOOP
    SELECT count(*) INTO v_accepted
      FROM public.cycle_renewal_votes v
      JOIN public.group_members gm
        ON gm.user_id = v.user_id AND gm.group_id = r.group_id AND gm.status = 'active'
     WHERE v.cycle_id = r.id AND v.agreed;

    PERFORM public.dispatch_renewal_notification(
      r.created_by, 'Délai de relance expiré',
      v_accepted || ' membres ont confirmé leur participation. Vous pouvez démarrer le cycle, prolonger le délai ou annuler la relance.',
      r.group_id, r.id, 'renewal_expired');

    UPDATE public.cycles SET renewal_expiry_notified_at = now() WHERE id = r.id;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION public.notify_expired_renewals() FROM public;