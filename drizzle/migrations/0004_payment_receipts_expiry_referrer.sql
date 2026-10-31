
CREATE TABLE public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  source_id text NOT NULL,
  group_id uuid,
  label text NOT NULL,
  amount bigint NOT NULL,
  provider text,
  payment_method text,
  hash text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, source_id)
);
GRANT SELECT ON public.payment_receipts TO authenticated;
GRANT ALL ON public.payment_receipts TO service_role;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payment receipts" ON public.payment_receipts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE INDEX ON public.payment_receipts(user_id, issued_at DESC);

CREATE OR REPLACE FUNCTION public.issue_payment_receipt(_kind text, _source text, _user uuid, _group uuid,
  _label text, _amount bigint, _provider text, _method text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_num text; v_hash text; v_email text; v_name text; v_url text := 'https://tontinedigitale.com/recus';
BEGIN
  IF _user IS NULL OR coalesce(_amount,0) <= 0 THEN RETURN NULL; END IF;
  SELECT id INTO v_id FROM public.payment_receipts WHERE kind=_kind AND source_id=_source;
  IF FOUND THEN RETURN v_id; END IF;
  v_num := 'TD-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text),1,6));
  v_hash := encode(sha256(convert_to(concat_ws('|',v_num,_kind,_source,_user,_amount,_provider,now()),'UTF8')),'hex');
  INSERT INTO public.payment_receipts(receipt_number,user_id,kind,source_id,group_id,label,amount,provider,payment_method,hash)
  VALUES (v_num,_user,_kind,_source,_group,_label,_amount,_provider,_method,v_hash)
  ON CONFLICT (kind, source_id) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN NULL; END IF;

  BEGIN
    PERFORM public.dispatch_notification(_user,'receipt_ready','Reçu de paiement disponible',
      format('Reçu %s — %s GNF (%s)', v_num, to_char(_amount,'FM999G999G999'), _label),
      jsonb_build_object('payment_receipt_id', v_id), _group, '/recus');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  SELECT email INTO v_email FROM auth.users WHERE id=_user;
  SELECT full_name INTO v_name FROM public.profiles WHERE id=_user;
  IF v_email IS NOT NULL AND v_email NOT ILIKE '%@phone.%' THEN
    INSERT INTO public.email_outbox(kind,payload,dedupe_key) VALUES ('notification', jsonb_build_object(
      'to', v_email,
      'subject', 'Votre reçu de paiement ' || v_num || ' — Tontine Digitale',
      'text', format(E'Bonjour %s,\n\nNous confirmons votre paiement.\nReçu : %s\nObjet : %s\nMontant : %s GNF\nMoyen : %s\nDate : %s\nEmpreinte : %s\n\nVotre reçu : %s\n\nTontine Digitale',
        coalesce(v_name,''), v_num, _label, to_char(_amount,'FM999G999G999'), coalesce(_method,_provider,'—'),
        to_char(now() AT TIME ZONE 'Africa/Conakry','DD/MM/YYYY HH24:MI'), left(v_hash,16), v_url),
      'html', format('<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a"><h2 style="color:#0D7377;margin:0 0 4px">Reçu de paiement</h2><p style="color:#64748b;margin:0 0 20px">Tontine Digitale</p><p>Bonjour %s,<br>nous confirmons la bonne réception de votre paiement.</p><table style="width:100%%;border-collapse:collapse;margin:16px 0;font-size:14px"><tr><td style="padding:8px 0;color:#64748b">N° de reçu</td><td style="text-align:right;font-weight:bold">%s</td></tr><tr><td style="padding:8px 0;color:#64748b">Objet</td><td style="text-align:right">%s</td></tr><tr><td style="padding:8px 0;color:#64748b">Moyen</td><td style="text-align:right">%s</td></tr><tr><td style="padding:8px 0;color:#64748b">Date</td><td style="text-align:right">%s</td></tr><tr><td style="padding:12px 0;border-top:1px solid #e2e8f0;font-weight:bold">Montant</td><td style="text-align:right;border-top:1px solid #e2e8f0;font-size:20px;font-weight:bold;color:#0D7377">%s GNF</td></tr></table><p style="font-size:11px;color:#94a3b8">Empreinte de vérification : %s</p><p><a href="%s" style="display:inline-block;background:#0D7377;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Voir mes reçus</a></p></div>',
        coalesce(v_name,''), v_num, _label, coalesce(_method,_provider,'—'),
        to_char(now() AT TIME ZONE 'Africa/Conakry','DD/MM/YYYY HH24:MI'), to_char(_amount,'FM999G999G999'), left(v_hash,16), v_url)
    ), 'receipt:' || v_id::text) ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.issue_payment_receipt(text,text,uuid,uuid,text,bigint,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_receipt_payments() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g text; t int;
BEGIN
  IF NEW.status='succeeded' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'succeeded') THEN
    SELECT gr.name, tu.turn_number INTO g, t FROM public.contributions c JOIN public.groups gr ON gr.id=c.group_id
      LEFT JOIN public.turns tu ON tu.id=c.turn_id WHERE c.id=NEW.contribution_id;
    BEGIN PERFORM public.issue_payment_receipt('contribution', NEW.id::text, NEW.user_id, NEW.group_id,
      'Cotisation ' || coalesce(g,'tontine') || coalesce(' — tour #'||t,''), NEW.amount, NEW.provider::text, NEW.payment_method);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'receipt payments %', SQLERRM; END;
  END IF; RETURN NEW; END $$;
CREATE TRIGGER payment_receipt_payments AFTER INSERT OR UPDATE OF status ON public.payments FOR EACH ROW EXECUTE FUNCTION public.trg_receipt_payments();

CREATE OR REPLACE FUNCTION public.trg_receipt_member_deposits() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status IN ('paid','held','confirmed','succeeded') AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    BEGIN PERFORM public.issue_payment_receipt('deposit', NEW.id::text, NEW.user_id, NEW.group_id,
      'Dépôt de garantie', NEW.amount, 'djomy', NEW.payment_method);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'receipt deposit %', SQLERRM; END;
  END IF; RETURN NEW; END $$;
CREATE TRIGGER payment_receipt_member_deposits AFTER INSERT OR UPDATE OF status ON public.member_deposits FOR EACH ROW EXECUTE FUNCTION public.trg_receipt_member_deposits();

CREATE OR REPLACE FUNCTION public.trg_receipt_solo() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status IN ('confirmed','succeeded','paid') AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    BEGIN PERFORM public.issue_payment_receipt('solo', NEW.id::text, NEW.user_id, NEW.group_id,
      'Épargne solo', NEW.amount, NEW.provider, NEW.payment_method);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'receipt solo %', SQLERRM; END;
  END IF; RETURN NEW; END $$;
CREATE TRIGGER payment_receipt_solo AFTER INSERT OR UPDATE OF status ON public.solo_deposits FOR EACH ROW EXECUTE FUNCTION public.trg_receipt_solo();

CREATE OR REPLACE FUNCTION public.trg_receipt_sms() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status IN ('paid','credited') AND (TG_OP='INSERT' OR OLD.status NOT IN ('paid','credited')) THEN
    BEGIN PERFORM public.issue_payment_receipt('sms', NEW.id::text, NEW.user_id, NEW.group_id,
      'Achat de ' || NEW.qty || ' SMS', NEW.amount, 'djomy', NULL);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'receipt sms %', SQLERRM; END;
  END IF; RETURN NEW; END $$;
CREATE TRIGGER payment_receipt_sms AFTER INSERT OR UPDATE OF status ON public.sms_orders FOR EACH ROW EXECUTE FUNCTION public.trg_receipt_sms();

CREATE OR REPLACE FUNCTION public.trg_receipt_subscription() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status='active' AND NEW.price_monthly > 0 AND NEW.current_period_end IS NOT NULL
     AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'active' OR OLD.current_period_end IS DISTINCT FROM NEW.current_period_end) THEN
    BEGIN PERFORM public.issue_payment_receipt('subscription', NEW.id::text || ':' || to_char(NEW.current_period_end,'YYYYMMDD'), NEW.user_id, NULL,
      'Abonnement ' || initcap(NEW.plan_code::text) || ' jusqu''au ' || to_char(NEW.current_period_end,'DD/MM/YYYY'), NEW.price_monthly, 'djomy', NULL);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'receipt sub %', SQLERRM; END;
  END IF; RETURN NEW; END $$;
CREATE TRIGGER payment_receipt_subscription AFTER INSERT OR UPDATE OF status, current_period_end ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.trg_receipt_subscription();

-- Expiration des abonnements
CREATE OR REPLACE FUNCTION public.expire_subscriptions() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; n_exp int := 0; n_rem int := 0;
BEGIN
  FOR r IN SELECT * FROM public.user_subscriptions WHERE status IN ('active','trialing')
      AND current_period_end IS NOT NULL AND current_period_end <= now() FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.user_subscriptions SET status='cancelled', cancelled_at=now(), updated_at=now() WHERE id=r.id;
    n_exp := n_exp + 1;
    BEGIN PERFORM public.dispatch_notification(r.user_id,'system','Votre abonnement Premium a expiré',
      'Votre période s''est terminée le ' || to_char(r.current_period_end,'DD/MM/YYYY') || '. Renouvelez pour retrouver vos avantages.',
      jsonb_build_object('reason','subscription_expired','subscription_id',r.id), NULL, '/abonnement');
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
  FOR r IN SELECT * FROM public.user_subscriptions s WHERE status='active' AND current_period_end BETWEEN now() AND now()+interval '3 days'
      AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id=s.user_id AND n.data->>'reason'='subscription_expiring'
                      AND n.data->>'period_end'=s.current_period_end::text) LOOP
    n_rem := n_rem + 1;
    BEGIN PERFORM public.dispatch_notification(r.user_id,'system','Votre abonnement expire bientôt',
      'Votre abonnement prend fin le ' || to_char(r.current_period_end,'DD/MM/YYYY') || '. Renouvelez pour ne pas perdre vos avantages.',
      jsonb_build_object('reason','subscription_expiring','period_end',r.current_period_end::text), NULL, '/abonnement');
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
  RETURN jsonb_build_object('expired',n_exp,'reminded',n_rem);
END $$;
REVOKE ALL ON FUNCTION public.expire_subscriptions() FROM PUBLIC, anon, authenticated;

-- Droits : un abonnement échu ne donne plus accès à Premium
CREATE OR REPLACE FUNCTION public.get_my_entitlements()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _uid uuid := auth.uid(); _sub public.user_subscriptions; _plan public.subscription_plans;
  _groups_used int; _members_total int; _members_max_in_group int; _valid boolean; _status text;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('authenticated', false); END IF;
  SELECT * INTO _sub FROM public.user_subscriptions WHERE user_id = _uid
    ORDER BY CASE WHEN status IN ('active','trialing') AND (current_period_end IS NULL OR current_period_end > now()) THEN 0
                  WHEN status IN ('active','trialing') THEN 1 WHEN status='past_due' THEN 2 WHEN status='pending' THEN 3 ELSE 4 END,
             updated_at DESC, created_at DESC, id DESC LIMIT 1;
  _valid := FOUND AND _sub.status IN ('active','trialing') AND (_sub.current_period_end IS NULL OR _sub.current_period_end > now());
  _status := CASE WHEN NOT FOUND THEN 'free' WHEN _sub.status IN ('active','trialing') AND NOT _valid THEN 'cancelled' ELSE _sub.status::text END;
  IF NOT _valid THEN
    SELECT * INTO _plan FROM public.subscription_plans WHERE code = 'free';
  ELSE
    SELECT * INTO _plan FROM public.subscription_plans WHERE code = _sub.plan_code;
    IF _sub.plan_code = 'premium' AND jsonb_typeof(_sub.tier_options) = 'object' THEN _plan.limits := _plan.limits || _sub.tier_options; END IF;
  END IF;
  SELECT count(*) INTO _groups_used FROM public.groups WHERE created_by = _uid AND status NOT IN ('cancelled','completed') AND deleted_at IS NULL;
  SELECT COALESCE(SUM(c),0), COALESCE(MAX(c),0) INTO _members_total, _members_max_in_group FROM (
    SELECT count(*)::int AS c FROM public.group_members gm JOIN public.groups g ON g.id = gm.group_id
    WHERE g.created_by = _uid AND g.status NOT IN ('cancelled','completed') AND g.deleted_at IS NULL
      AND gm.status IN ('active','invited','pending') GROUP BY gm.group_id) sub;
  RETURN jsonb_build_object('authenticated', true, 'plan_code', _plan.code, 'plan_label', _plan.label,
    'base_price', _plan.base_price, 'sms_included', _plan.sms_included, 'limits', _plan.limits,
    'status', _status, 'current_period_end', _sub.current_period_end,
    'price_monthly', CASE WHEN _valid THEN COALESCE(_sub.price_monthly, _plan.base_price) ELSE _plan.base_price END,
    'tier_options', CASE WHEN _valid THEN COALESCE(_sub.tier_options, '{}'::jsonb) ELSE '{}'::jsonb END,
    'read_only', COALESCE(_sub.status = 'past_due', false),
    'usage', jsonb_build_object('groups', _groups_used, 'members_total', _members_total, 'max_members_in_group', _members_max_in_group));
END; $function$;

-- Parrain du membre connecté
CREATE OR REPLACE FUNCTION public.get_my_referrer() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('full_name', p.full_name, 'since', r.created_at)
  FROM public.referrals r JOIN public.profiles p ON p.id=r.referrer_id WHERE r.referred_id=auth.uid() LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_my_referrer() TO authenticated;
