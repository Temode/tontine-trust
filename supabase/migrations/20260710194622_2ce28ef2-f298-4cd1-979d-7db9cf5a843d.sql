CREATE OR REPLACE FUNCTION public.apply_sms_order_webhook(
  _order_id  uuid,
  _new_status text,
  _djomy_ref  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order   public.sms_orders%ROWTYPE;
  _mapped  public.sms_order_status;
  _admin   RECORD;
  _prof    RECORD;
BEGIN
  SELECT * INTO _order FROM public.sms_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  _mapped := CASE _new_status
    WHEN 'succeeded' THEN 'paid'::public.sms_order_status
    WHEN 'paid'      THEN 'paid'::public.sms_order_status
    WHEN 'failed'    THEN 'failed'::public.sms_order_status
    WHEN 'cancelled' THEN 'cancelled'::public.sms_order_status
    ELSE NULL
  END;
  IF _mapped IS NULL THEN RETURN; END IF;

  -- idempotence
  IF _order.status IN ('credited','cancelled','failed') THEN
    UPDATE public.sms_orders
       SET djomy_ref = COALESCE(_djomy_ref, djomy_ref), updated_at = now()
     WHERE id = _order_id;
    RETURN;
  END IF;

  IF _mapped = 'paid' THEN
    PERFORM public.sms_wallet_credit(
      _order.user_id,
      _order.qty,
      'purchase'::public.sms_ledger_reason,
      _order.id,
      jsonb_build_object('pack_id', _order.pack_id, 'group_id', _order.group_id, 'djomy_ref', _djomy_ref)
    );

    UPDATE public.sms_orders
       SET status = 'credited',
           djomy_ref = COALESCE(_djomy_ref, djomy_ref),
           updated_at = now()
     WHERE id = _order_id;

    INSERT INTO public.notifications (user_id, kind, title, body, data, link)
    VALUES (
      _order.user_id,
      'sms_wallet_credited'::public.notification_kind,
      'Forfait SMS rechargé',
      format('Votre commande de %s SMS a été créditée.', _order.qty),
      jsonb_build_object('order_id', _order.id, 'qty', _order.qty),
      '/profil'
    );

    FOR _admin IN
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'super_admin'
    LOOP
      INSERT INTO public.notifications (user_id, kind, title, body, data, link)
      VALUES (
        _admin.user_id,
        'sms_order_paid'::public.notification_kind,
        'Nouvelle commande SMS payée',
        format('Commande %s SMS (%s GNF) créditée.', _order.qty, _order.amount),
        jsonb_build_object('order_id', _order.id, 'buyer_id', _order.user_id, 'amount', _order.amount),
        '/admin/sms-orders'
      );

      SELECT id, email INTO _prof FROM public.profiles WHERE id = _admin.user_id;
      IF _prof.email IS NOT NULL THEN
        INSERT INTO public.email_outbox (kind, dedupe_key, status, payload)
        VALUES (
          'sms_order_paid',
          'sms_order_paid:' || _order.id::text || ':' || _admin.user_id::text,
          'pending',
          jsonb_build_object(
            'to', _prof.email,
            'subject', 'Nouvelle commande SMS créditée',
            'html', format(
              '<p>Commande <b>%s SMS</b> pour <b>%s GNF</b> vient d''être créditée.</p><p>Réf. Djomy&nbsp;: %s</p>',
              _order.qty, _order.amount, COALESCE(_djomy_ref, '—')
            ),
            'order_id', _order.id,
            'buyer_id', _order.user_id
          )
        )
        ON CONFLICT (dedupe_key) DO NOTHING;
      END IF;
    END LOOP;
  ELSE
    UPDATE public.sms_orders
       SET status = _mapped,
           djomy_ref = COALESCE(_djomy_ref, djomy_ref),
           updated_at = now()
     WHERE id = _order_id;

    INSERT INTO public.notifications (user_id, kind, title, body, data, link)
    VALUES (
      _order.user_id,
      (CASE _mapped WHEN 'failed' THEN 'sms_order_failed'
                     ELSE 'sms_order_cancelled' END)::public.notification_kind,
      CASE _mapped WHEN 'failed' THEN 'Recharge SMS échouée' ELSE 'Recharge SMS annulée' END,
      format('Votre commande de %s SMS n''a pas pu être créditée.', _order.qty),
      jsonb_build_object('order_id', _order.id),
      '/profil'
    );
  END IF;
END;
$$;