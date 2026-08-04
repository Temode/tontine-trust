-- 1) Cotisation confirmée -> séquestre client + redistribution de pénalité
CREATE OR REPLACE FUNCTION public.trg_accounting_contribution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'confirmed'::public.contribution_status
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.record_platform_entry(
      'client_escrow', 'contribution', 'in', NEW.amount,
      'contribution:' || NEW.id::text,
      NEW.payer_user_id, NEW.group_id, NULL, NULL, NULL, NULL,
      'Cotisation confirmée'
    );
    IF COALESCE(NEW.penalty_amount, 0) > 0 THEN
      PERFORM public.distribute_penalty(NEW.id, true);
    END IF;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_accounting_contribution ON public.contributions;
CREATE TRIGGER trg_accounting_contribution
AFTER INSERT OR UPDATE OF status ON public.contributions
FOR EACH ROW EXECUTE FUNCTION public.trg_accounting_contribution();

-- 2) Frais de retrait à la création de la demande
CREATE OR REPLACE FUNCTION public.trg_withdrawal_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.fee_amount := public.compute_withdrawal_fee(NEW.amount);
  NEW.net_amount := NEW.amount - NEW.fee_amount;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_withdrawal_fee ON public.user_withdrawal_requests;
CREATE TRIGGER trg_withdrawal_fee
BEFORE INSERT ON public.user_withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_withdrawal_fee();

-- 3) Retrait payé -> sortie séquestre + revenu frais
CREATE OR REPLACE FUNCTION public.trg_accounting_withdrawal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed'::public.user_withdrawal_status
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.record_platform_entry(
      'client_escrow', 'payout', 'out', NEW.amount,
      'withdrawal:' || NEW.id::text,
      NEW.user_id, NULL, NULL, NULL, NULL, NEW.id, 'Retrait payé'
    );
    IF COALESCE(NEW.fee_amount, 0) > 0 THEN
      PERFORM public.record_platform_entry(
        'platform_revenue', 'withdrawal_fee', 'in', NEW.fee_amount,
        'withdrawal_fee:' || NEW.id::text,
        NEW.user_id, NULL, NULL, NULL, NULL, NEW.id, 'Frais de retrait'
      );
    END IF;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_accounting_withdrawal ON public.user_withdrawal_requests;
CREATE TRIGGER trg_accounting_withdrawal
AFTER UPDATE OF status ON public.user_withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_accounting_withdrawal();

-- 4) Recharge SMS créditée -> revenu plateforme
CREATE OR REPLACE FUNCTION public.trg_accounting_sms_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'credited'::public.sms_order_status
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.record_platform_entry(
      'platform_revenue', 'sms_pack', 'in', NEW.amount::bigint,
      'sms_order:' || NEW.id::text,
      NEW.user_id, NEW.group_id, NULL, NEW.id, NULL, NULL,
      'Recharge SMS (' || NEW.qty || ' SMS)'
    );
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_accounting_sms_order ON public.sms_orders;
CREATE TRIGGER trg_accounting_sms_order
AFTER UPDATE OF status ON public.sms_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_accounting_sms_order();

-- 5) Abonnement activé -> revenu plateforme
CREATE OR REPLACE FUNCTION public.trg_accounting_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active'::public.subscription_status
     AND COALESCE(NEW.price_monthly, 0) > 0
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status
          OR OLD.current_period_end IS DISTINCT FROM NEW.current_period_end) THEN
    PERFORM public.record_platform_entry(
      'platform_revenue', 'subscription', 'in', NEW.price_monthly::bigint,
      'subscription:' || NEW.id::text || ':' || COALESCE(NEW.current_period_end::text, 'na'),
      NEW.user_id, NULL, NULL, NULL, NEW.id, NULL,
      'Abonnement ' || NEW.plan_code::text
    );
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_accounting_subscription ON public.user_subscriptions;
CREATE TRIGGER trg_accounting_subscription
AFTER INSERT OR UPDATE OF status, current_period_end ON public.user_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.trg_accounting_subscription();

-- =====================================================================
-- 6) Rattrapage de l'historique
-- =====================================================================
DO $$
DECLARE r RECORD; v_done int := 0;
BEGIN
  -- Cotisations confirmées
  FOR r IN SELECT id, amount, payer_user_id, group_id FROM public.contributions
            WHERE status = 'confirmed'::public.contribution_status LOOP
    PERFORM public.record_platform_entry('client_escrow','contribution','in', r.amount,
      'contribution:' || r.id::text, r.payer_user_id, r.group_id, NULL, NULL, NULL, NULL,
      'Cotisation confirmée (rattrapage)');
  END LOOP;

  -- Retraits payés
  FOR r IN SELECT id, user_id, amount, fee_amount FROM public.user_withdrawal_requests
            WHERE status = 'completed'::public.user_withdrawal_status LOOP
    PERFORM public.record_platform_entry('client_escrow','payout','out', r.amount,
      'withdrawal:' || r.id::text, r.user_id, NULL, NULL, NULL, NULL, r.id, 'Retrait payé (rattrapage)');
    IF COALESCE(r.fee_amount,0) > 0 THEN
      PERFORM public.record_platform_entry('platform_revenue','withdrawal_fee','in', r.fee_amount,
        'withdrawal_fee:' || r.id::text, r.user_id, NULL, NULL, NULL, NULL, r.id, 'Frais de retrait (rattrapage)');
    END IF;
  END LOOP;

  -- Recharges SMS créditées
  FOR r IN SELECT id, user_id, group_id, amount, qty FROM public.sms_orders
            WHERE status = 'credited'::public.sms_order_status LOOP
    PERFORM public.record_platform_entry('platform_revenue','sms_pack','in', r.amount::bigint,
      'sms_order:' || r.id::text, r.user_id, r.group_id, NULL, r.id, NULL, NULL,
      'Recharge SMS (rattrapage)');
  END LOOP;

  -- Abonnements payants actifs
  FOR r IN SELECT id, user_id, price_monthly, plan_code, current_period_end
             FROM public.user_subscriptions
            WHERE status = 'active'::public.subscription_status AND COALESCE(price_monthly,0) > 0 LOOP
    PERFORM public.record_platform_entry('platform_revenue','subscription','in', r.price_monthly::bigint,
      'subscription:' || r.id::text || ':' || COALESCE(r.current_period_end::text,'na'),
      r.user_id, NULL, NULL, NULL, r.id, NULL, 'Abonnement (rattrapage)');
  END LOOP;

  -- Pénalités historiques : redistribution sans notification unitaire
  FOR r IN SELECT id FROM public.contributions
            WHERE COALESCE(penalty_amount,0) > 0
              AND NOT EXISTS (SELECT 1 FROM public.penalty_distributions pd
                               WHERE pd.contribution_id = contributions.id AND pd.reverted_at IS NULL) LOOP
    PERFORM public.distribute_penalty(r.id, false);
    v_done := v_done + 1;
  END LOOP;

  -- Notification récapitulative unique par membre crédité
  IF v_done > 0 THEN
    INSERT INTO public.notifications (user_id, kind, title, body, data, link)
    SELECT pd.beneficiary_user_id, 'penalty_share_received'::public.notification_kind,
           'Parts de pénalités créditées',
           format('Un total de %s GNF issus de pénalités de retard a été crédité sur votre solde.',
                  SUM(pd.amount)),
           jsonb_build_object('total', SUM(pd.amount), 'backfill', true),
           '/mon-solde'
      FROM public.penalty_distributions pd
     WHERE pd.reverted_at IS NULL
     GROUP BY pd.beneficiary_user_id;
  END IF;
END $$;
