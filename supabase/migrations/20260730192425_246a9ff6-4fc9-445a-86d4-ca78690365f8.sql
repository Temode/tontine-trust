-- =========================================================
-- 1) Alertes d'exploitation (ops)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.ops_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL,
  email_status text NOT NULL DEFAULT 'skipped',
  sms_status text NOT NULL DEFAULT 'skipped',
  webhook_status text NOT NULL DEFAULT 'skipped',
  webhook_error text,
  webhook_sent_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ops_alerts_dedupe_key_idx ON public.ops_alerts (dedupe_key);
CREATE INDEX IF NOT EXISTS ops_alerts_open_idx ON public.ops_alerts (created_at DESC) WHERE acknowledged_at IS NULL;

GRANT SELECT ON public.ops_alerts TO authenticated;
GRANT ALL ON public.ops_alerts TO service_role;
ALTER TABLE public.ops_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ops_alerts_admin_read" ON public.ops_alerts;
CREATE POLICY "ops_alerts_admin_read" ON public.ops_alerts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS public.ops_alert_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('email','sms','webhook')),
  target text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  min_severity text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ops_alert_recipients_uniq ON public.ops_alert_recipients (channel, target);

GRANT SELECT ON public.ops_alert_recipients TO authenticated;
GRANT ALL ON public.ops_alert_recipients TO service_role;
ALTER TABLE public.ops_alert_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ops_recipients_admin_read" ON public.ops_alert_recipients;
CREATE POLICY "ops_recipients_admin_read" ON public.ops_alert_recipients
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.tg_ops_recipients_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ops_recipients_updated ON public.ops_alert_recipients;
CREATE TRIGGER trg_ops_recipients_updated
  BEFORE UPDATE ON public.ops_alert_recipients
  FOR EACH ROW EXECUTE FUNCTION public.tg_ops_recipients_touch();

-- =========================================================
-- 2) Blocages de retrait
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_withdrawal_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  finding_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  released_by uuid,
  release_note text
);
CREATE INDEX IF NOT EXISTS uwb_open_idx ON public.user_withdrawal_blocks (user_id) WHERE released_at IS NULL;

GRANT SELECT ON public.user_withdrawal_blocks TO authenticated;
GRANT ALL ON public.user_withdrawal_blocks TO service_role;
ALTER TABLE public.user_withdrawal_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "uwb_self_or_admin_read" ON public.user_withdrawal_blocks;
CREATE POLICY "uwb_self_or_admin_read" ON public.user_withdrawal_blocks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- =========================================================
-- 3) raise_ops_alert : alerte multi-canal (email + SMS + webhook)
-- =========================================================
CREATE OR REPLACE FUNCTION public.raise_ops_alert(
  _code text,
  _severity text,
  _message text,
  _context jsonb DEFAULT '{}'::jsonb,
  _dedupe_key text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_key text;
  v_sev text := COALESCE(NULLIF(_severity, ''), 'warning');
  v_subject text;
  v_html text;
  v_text text;
  v_admins uuid[];
  v_has_email boolean := false;
  v_has_sms boolean := false;
  v_has_hook boolean := false;
  r record;
BEGIN
  v_key := COALESCE(
    _dedupe_key,
    _code || ':' || md5(COALESCE(_message, '') || COALESCE(_context::text, '')) || ':' ||
      to_char(date_trunc('hour', now()), 'YYYYMMDDHH24')
  );

  SELECT EXISTS (SELECT 1 FROM public.ops_alert_recipients WHERE enabled AND channel = 'email') INTO v_has_email;
  SELECT EXISTS (SELECT 1 FROM public.ops_alert_recipients WHERE enabled AND channel = 'sms') INTO v_has_sms;
  SELECT EXISTS (SELECT 1 FROM public.ops_alert_recipients WHERE enabled AND channel = 'webhook') INTO v_has_hook;

  INSERT INTO public.ops_alerts (code, severity, message, context, dedupe_key,
                                 email_status, sms_status, webhook_status)
  VALUES (_code, v_sev, COALESCE(_message, _code), COALESCE(_context, '{}'::jsonb), v_key,
          CASE WHEN v_has_email THEN 'queued' ELSE 'skipped' END,
          CASE WHEN v_has_sms THEN 'queued' ELSE 'skipped' END,
          CASE WHEN v_has_hook THEN 'queued' ELSE 'skipped' END)
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN NULL; -- déjà signalée sur la fenêtre courante
  END IF;

  v_subject := format('[Tontine %s] %s', upper(v_sev), _code);
  v_text := COALESCE(_message, _code) || E'\n\nContexte : ' || COALESCE(_context::text, '{}');
  v_html := format(
    '<div style="font-family:Arial,sans-serif;color:#0F172A"><h2 style="color:#0D7377;margin:0 0 8px">%s</h2>'
    || '<p style="font-size:15px">%s</p><pre style="background:#F1F5F9;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap">%s</pre>'
    || '<p style="font-size:12px;color:#475569">Alerte automatique — Tontine Digitale</p></div>',
    v_subject, COALESCE(_message, _code), COALESCE(_context::text, '{}')
  );

  -- Email : une entrée outbox par destinataire actif
  FOR r IN SELECT target FROM public.ops_alert_recipients WHERE enabled AND channel = 'email' LOOP
    INSERT INTO public.email_outbox (kind, payload, dedupe_key)
    VALUES ('ops_alert',
            jsonb_build_object('to', r.target, 'subject', v_subject, 'html', v_html, 'text', v_text,
                               'alert_id', v_id, 'code', _code, 'severity', v_sev),
            'ops:' || v_id::text || ':' || r.target)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;

  -- SMS : envoyé aux comptes admin / super_admin (numéros vérifiés en base)
  IF v_has_sms THEN
    SELECT array_agg(DISTINCT ur.user_id) INTO v_admins
      FROM public.user_roles ur
     WHERE ur.role IN ('admin', 'super_admin');
    IF v_admins IS NOT NULL THEN
      BEGIN
        PERFORM public.enqueue_generic_sms(
          'ops_alert',
          v_admins,
          left(format('[%s] %s', _code, COALESCE(_message, '')), 300)
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.raise_ops_alert(text, text, text, jsonb, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.raise_ops_alert(text, text, text, jsonb, text) TO service_role;

-- Signalement d'incident applicatif (front / edge) — rate-limité par dedupe horaire
CREATE OR REPLACE FUNCTION public.report_client_incident(
  _code text,
  _message text,
  _context jsonb DEFAULT '{}'::jsonb,
  _severity text DEFAULT 'warning'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ctx jsonb;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;
  v_ctx := COALESCE(_context, '{}'::jsonb) || jsonb_build_object('user_id', v_uid, 'reported_at', now());
  RETURN public.raise_ops_alert(
    'app.' || left(regexp_replace(_code, '[^a-zA-Z0-9_.:-]', '_', 'g'), 60),
    CASE WHEN _severity IN ('info','warning','critical') THEN _severity ELSE 'warning' END,
    left(COALESCE(_message, _code), 500),
    v_ctx,
    'app:' || left(_code, 60) || ':' || COALESCE(v_uid::text, 'anon') || ':'
      || to_char(date_trunc('hour', now()), 'YYYYMMDDHH24')
  );
END $$;

GRANT EXECUTE ON FUNCTION public.report_client_incident(text, text, jsonb, text) TO authenticated, anon;

-- =========================================================
-- 4) Garde-fou retraits
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_withdrawal_blocked(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_withdrawal_blocks
     WHERE user_id = _uid AND released_at IS NULL
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_withdrawal_blocked(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_withdrawal_block()
RETURNS TABLE (id uuid, reason text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT b.id, b.reason, b.created_at
    FROM public.user_withdrawal_blocks b
   WHERE b.user_id = auth.uid() AND b.released_at IS NULL
   ORDER BY b.created_at DESC
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.my_withdrawal_block() TO authenticated;

CREATE OR REPLACE FUNCTION public.block_user_withdrawals(_user_id uuid, _reason text, _finding_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.user_withdrawal_blocks
   WHERE user_id = _user_id AND released_at IS NULL LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO public.user_withdrawal_blocks (user_id, reason, finding_id)
  VALUES (_user_id, _reason, _finding_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.block_user_withdrawals(uuid, text, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.block_user_withdrawals(uuid, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_list_withdrawal_blocks(_only_open boolean DEFAULT true)
RETURNS TABLE (
  id uuid, user_id uuid, full_name text, reason text, finding_id uuid,
  created_at timestamptz, released_at timestamptz, release_note text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
    SELECT b.id, b.user_id, p.full_name, b.reason, b.finding_id,
           b.created_at, b.released_at, b.release_note
      FROM public.user_withdrawal_blocks b
      LEFT JOIN public.profiles p ON p.id = b.user_id
     WHERE (NOT _only_open) OR b.released_at IS NULL
     ORDER BY b.created_at DESC
     LIMIT 300;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_list_withdrawal_blocks(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_release_withdrawal_block(_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_user uuid;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  UPDATE public.user_withdrawal_blocks
     SET released_at = now(), released_by = v_uid, release_note = _note
   WHERE id = _id AND released_at IS NULL
   RETURNING user_id INTO v_user;

  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (v_uid, 'withdrawal_block_released', 'user_withdrawal_blocks', _id,
          jsonb_build_object('note', _note, 'user_id', v_user));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_release_withdrawal_block(uuid, text) TO authenticated;

-- Blocage + alerte à chaque écart détecté
CREATE OR REPLACE FUNCTION public.tg_finding_alert_and_block()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.block_user_withdrawals(
    NEW.user_id,
    'Incohérence de solde détectée (' || NEW.code || ') — retraits suspendus jusqu''à validation admin',
    NEW.id
  );

  PERFORM public.raise_ops_alert(
    'reconciliation.' || NEW.code,
    COALESCE(NEW.severity, 'warning'),
    format('Écart de solde détecté : %s (attendu %s / constaté %s, écart %s)',
           NEW.code, NEW.expected_amount, NEW.actual_amount, NEW.delta),
    jsonb_build_object(
      'finding_id', NEW.id, 'user_id', NEW.user_id, 'code', NEW.code,
      'expected', NEW.expected_amount, 'actual', NEW.actual_amount, 'delta', NEW.delta,
      'details', NEW.details
    ),
    'finding:' || NEW.id::text
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_finding_alert_and_block ON public.balance_reconciliation_findings;
CREATE TRIGGER trg_finding_alert_and_block
  AFTER INSERT ON public.balance_reconciliation_findings
  FOR EACH ROW EXECUTE FUNCTION public.tg_finding_alert_and_block();

-- Clôture d'un écart : libère le blocage s'il n'y a plus d'anomalie ouverte
CREATE OR REPLACE FUNCTION public.admin_resolve_reconciliation_finding(_id uuid, _note text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_user uuid; v_open integer;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.balance_reconciliation_findings
  SET resolved_at = now(),
      resolved_by = v_uid,
      details = details || jsonb_build_object('resolution_note', _note)
  WHERE id = _id AND resolved_at IS NULL
  RETURNING user_id INTO v_user;

  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (v_uid, 'reconciliation_finding_resolved', 'balance_reconciliation_findings', _id,
          jsonb_build_object('note', _note));

  IF v_user IS NOT NULL THEN
    SELECT count(*) INTO v_open
      FROM public.balance_reconciliation_findings
     WHERE user_id = v_user AND resolved_at IS NULL;
    IF v_open = 0 THEN
      UPDATE public.user_withdrawal_blocks
         SET released_at = now(), released_by = v_uid,
             release_note = COALESCE(_note, 'Écart clôturé — retraits réactivés')
       WHERE user_id = v_user AND released_at IS NULL;
    END IF;
  END IF;
END $$;

-- =========================================================
-- 5) request_user_withdrawal : refus si blocage actif
-- =========================================================
CREATE OR REPLACE FUNCTION public.request_user_withdrawal(_amount bigint, _method user_withdrawal_channel, _details jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_available bigint;
  v_id uuid;
  v_sqlstate text;
  v_msg text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF public.is_withdrawal_blocked(v_uid) THEN
    RAISE EXCEPTION 'WITHDRAWAL_BLOCKED';
  END IF;

  IF _method IN ('mobile_money_om', 'mobile_money_momo') THEN
    IF NOT (_details ? 'phone') OR length(trim(_details->>'phone')) < 8 THEN
      RAISE EXCEPTION 'INVALID_PHONE';
    END IF;
    IF NOT (_details ? 'phone_confirm') OR _details->>'phone' <> _details->>'phone_confirm' THEN
      RAISE EXCEPTION 'PHONE_MISMATCH';
    END IF;
  ELSIF _method = 'card' THEN
    IF NOT (_details ? 'cardholder_name') OR length(trim(_details->>'cardholder_name')) = 0 THEN
      RAISE EXCEPTION 'INVALID_CARDHOLDER';
    END IF;
    IF NOT (_details ? 'card_number') OR length(regexp_replace(_details->>'card_number', '\s', '', 'g')) < 12 THEN
      RAISE EXCEPTION 'INVALID_CARD_NUMBER';
    END IF;
  ELSIF _method = 'bank_transfer' THEN
    IF NOT (_details ? 'bank_name') OR length(trim(_details->>'bank_name')) = 0 THEN
      RAISE EXCEPTION 'INVALID_BANK_NAME';
    END IF;
    IF NOT (_details ? 'account_number') OR length(trim(_details->>'account_number')) < 5 THEN
      RAISE EXCEPTION 'INVALID_ACCOUNT_NUMBER';
    END IF;
    IF NOT (_details ? 'account_holder') OR length(trim(_details->>'account_holder')) = 0 THEN
      RAISE EXCEPTION 'INVALID_ACCOUNT_HOLDER';
    END IF;
  END IF;

  BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('user_withdrawal:' || v_uid::text, 0));

    PERFORM 1 FROM public.beneficiary_balances WHERE user_id = v_uid FOR UPDATE;

    SELECT available_amount INTO v_available FROM public.get_my_wallet();

    IF v_available < _amount THEN
      RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
    END IF;

    INSERT INTO public.user_withdrawal_requests (user_id, amount, payment_method, payment_details, status)
    VALUES (v_uid, _amount, _method, _details, 'pending')
    RETURNING id INTO v_id;

    RETURN v_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    BEGIN
      INSERT INTO public.audit_log (actor_user_id, action, entity_type, metadata)
      VALUES (
        v_uid, 'withdrawal_request_failed', 'user_withdrawal_request',
        jsonb_build_object('sqlstate', v_sqlstate, 'message', v_msg,
                           'amount', _amount, 'method', _method::text)
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RAISE;
  END;
END $$;

-- =========================================================
-- 6) RPC admin : alertes & destinataires
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_list_ops_alerts(_only_open boolean DEFAULT true, _limit integer DEFAULT 100)
RETURNS SETOF public.ops_alerts
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
    SELECT * FROM public.ops_alerts a
     WHERE (NOT _only_open) OR a.acknowledged_at IS NULL
     ORDER BY a.created_at DESC
     LIMIT LEAST(COALESCE(_limit,100), 500);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_list_ops_alerts(boolean, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_ack_ops_alert(_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  UPDATE public.ops_alerts SET acknowledged_at = now(), acknowledged_by = v_uid
   WHERE id = _id AND acknowledged_at IS NULL;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_ack_ops_alert(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_ops_recipient(_channel text, _target text, _enabled boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _channel NOT IN ('email','sms','webhook') THEN RAISE EXCEPTION 'INVALID_CHANNEL'; END IF;
  IF _target IS NULL OR length(trim(_target)) < 3 THEN RAISE EXCEPTION 'INVALID_TARGET'; END IF;

  INSERT INTO public.ops_alert_recipients (channel, target, enabled)
  VALUES (_channel, trim(_target), _enabled)
  ON CONFLICT (channel, target) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_upsert_ops_recipient(text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_ops_recipient(_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  DELETE FROM public.ops_alert_recipients WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_delete_ops_recipient(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_ops_recipients()
RETURNS SETOF public.ops_alert_recipients
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY SELECT * FROM public.ops_alert_recipients ORDER BY channel, target;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_list_ops_recipients() TO authenticated;

-- File webhook consommée par l'edge function ops-alert-dispatch (service_role)
CREATE OR REPLACE FUNCTION public.ops_alert_webhook_pop(_limit integer DEFAULT 20)
RETURNS TABLE (id uuid, code text, severity text, message text, context jsonb, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.ops_alerts a
     SET webhook_status = 'sending'
   WHERE a.id IN (
     SELECT x.id FROM public.ops_alerts x
      WHERE x.webhook_status = 'queued'
      ORDER BY x.created_at
      LIMIT LEAST(COALESCE(_limit, 20), 50)
      FOR UPDATE SKIP LOCKED
   )
  RETURNING a.id, a.code, a.severity, a.message, a.context, a.created_at;
END $$;
REVOKE ALL ON FUNCTION public.ops_alert_webhook_pop(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_alert_webhook_pop(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.ops_alert_webhook_mark(_id uuid, _status text, _error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.ops_alerts
     SET webhook_status = _status,
         webhook_error = _error,
         webhook_sent_at = CASE WHEN _status = 'sent' THEN now() ELSE webhook_sent_at END
   WHERE id = _id;
END $$;
REVOKE ALL ON FUNCTION public.ops_alert_webhook_mark(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_alert_webhook_mark(uuid, text, text) TO service_role;