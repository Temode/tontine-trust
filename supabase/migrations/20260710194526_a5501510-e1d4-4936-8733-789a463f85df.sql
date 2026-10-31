-- =============================================================
-- M5 — Recharge SMS depuis un groupe
-- =============================================================

-- 1) Crédit atomique wallet + ledger (appelé par webhook / admin)
CREATE OR REPLACE FUNCTION public.sms_wallet_credit(
  _user_id  uuid,
  _qty      int,
  _reason   public.sms_ledger_reason,
  _ref_id   uuid,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_bal int;
BEGIN
  IF _qty IS NULL OR _qty <= 0 THEN
    RAISE EXCEPTION 'invalid_qty';
  END IF;

  INSERT INTO public.sms_wallets (user_id, balance_remaining, total_purchased, total_consumed)
  VALUES (_user_id, _qty, _qty, 0)
  ON CONFLICT (user_id) DO UPDATE
     SET balance_remaining = public.sms_wallets.balance_remaining + EXCLUDED.balance_remaining,
         total_purchased   = public.sms_wallets.total_purchased   + EXCLUDED.total_purchased,
         updated_at        = now()
  RETURNING balance_remaining INTO _new_bal;

  INSERT INTO public.sms_ledger (user_id, delta, reason, ref_id, metadata)
  VALUES (_user_id, _qty, _reason, _ref_id, COALESCE(_metadata, '{}'::jsonb));

  RETURN _new_bal;
END;
$$;

REVOKE ALL ON FUNCTION public.sms_wallet_credit(uuid,int,public.sms_ledger_reason,uuid,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.sms_wallet_credit(uuid,int,public.sms_ledger_reason,uuid,jsonb) TO service_role;

-- 2) Démarre une commande SMS pour l'utilisateur courant à partir d'un pack actif
CREATE OR REPLACE FUNCTION public.start_sms_order_checkout(
  _pack_id  text,
  _group_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, qty int, amount int, unit_price int, pack_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid       uuid := auth.uid();
  _pricing   public.sms_pricing%ROWTYPE;
  _pack      jsonb;
  _pack_qty  int;
  _pack_price int;
  _order     public.sms_orders%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _pricing
    FROM public.sms_pricing
   WHERE is_active = true
   ORDER BY effective_from DESC
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sms_pricing_not_configured';
  END IF;

  SELECT p INTO _pack
    FROM jsonb_array_elements(_pricing.packs) AS p
   WHERE p->>'id' = _pack_id
   LIMIT 1;
  IF _pack IS NULL THEN
    RAISE EXCEPTION 'pack_not_found';
  END IF;

  _pack_qty   := (_pack->>'qty')::int;
  _pack_price := (_pack->>'price')::int;
  IF _pack_qty IS NULL OR _pack_qty <= 0 OR _pack_price IS NULL OR _pack_price <= 0 THEN
    RAISE EXCEPTION 'pack_invalid';
  END IF;

  -- Si un group_id est fourni, l'utilisateur doit être membre actif du groupe.
  IF _group_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.group_members
       WHERE group_id = _group_id
         AND user_id = _uid
         AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'not_group_member' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.sms_orders (user_id, group_id, pack_id, qty, unit_price, amount, status)
  VALUES (_uid, _group_id, _pack_id, _pack_qty, _pricing.unit_price, _pack_price, 'pending')
  RETURNING * INTO _order;

  id := _order.id;
  qty := _order.qty;
  amount := _order.amount;
  unit_price := _order.unit_price;
  pack_id := _order.pack_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.start_sms_order_checkout(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.start_sms_order_checkout(text, uuid) TO authenticated;

-- 3) Webhook Djomy : applique le statut à une commande SMS
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
  _order      public.sms_orders%ROWTYPE;
  _mapped     public.sms_order_status;
  _admin      RECORD;
  _profile    RECORD;
BEGIN
  SELECT * INTO _order FROM public.sms_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE NOTICE 'sms order % not found', _order_id;
    RETURN;
  END IF;

  _mapped := CASE _new_status
    WHEN 'succeeded' THEN 'paid'::public.sms_order_status
    WHEN 'paid'      THEN 'paid'::public.sms_order_status
    WHEN 'failed'    THEN 'failed'::public.sms_order_status
    WHEN 'cancelled' THEN 'cancelled'::public.sms_order_status
    ELSE NULL
  END;
  IF _mapped IS NULL THEN
    RETURN; -- pending/created/redirected : rien à faire
  END IF;

  -- idempotence : une commande déjà créditée ne repasse pas par le crédit
  IF _order.status IN ('credited','cancelled','failed') THEN
    UPDATE public.sms_orders
       SET djomy_ref = COALESCE(_djomy_ref, djomy_ref),
           updated_at = now()
     WHERE id = _order_id;
    RETURN;
  END IF;

  IF _mapped = 'paid' THEN
    -- Crédit du wallet + ledger
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

    -- Notif in-app à l'acheteur
    INSERT INTO public.notifications (user_id, kind, title, body, data, url)
    VALUES (
      _order.user_id,
      'sms_wallet_credited',
      'Forfait SMS rechargé',
      format('Votre commande de %s SMS a été créditée.', _order.qty),
      jsonb_build_object('order_id', _order.id, 'qty', _order.qty),
      '/profil'
    );

    -- Notif admins (in-app + email)
    FOR _admin IN
      SELECT ur.user_id
        FROM public.user_roles ur
       WHERE ur.role = 'super_admin'
    LOOP
      INSERT INTO public.notifications (user_id, kind, title, body, data, url)
      VALUES (
        _admin.user_id,
        'sms_order_paid',
        'Nouvelle commande SMS payée',
        format('Commande %s SMS (%s GNF) créditée.', _order.qty, _order.amount),
        jsonb_build_object('order_id', _order.id, 'buyer_id', _order.user_id, 'amount', _order.amount),
        '/admin/sms-orders'
      );

      SELECT id, email INTO _profile FROM public.profiles WHERE id = _admin.user_id;
      IF _profile.email IS NOT NULL THEN
        INSERT INTO public.email_outbox (recipient, subject, body_html, dedupe_key, metadata)
        VALUES (
          _profile.email,
          'Nouvelle commande SMS créditée',
          format('<p>Commande <b>%s SMS</b> pour <b>%s GNF</b> vient d''être créditée.</p><p>Réf. Djomy&nbsp;: %s</p>',
                 _order.qty, _order.amount, COALESCE(_djomy_ref, '—')),
          'sms_order_paid:' || _order.id::text,
          jsonb_build_object('order_id', _order.id, 'buyer_id', _order.user_id)
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  ELSE
    UPDATE public.sms_orders
       SET status = _mapped,
           djomy_ref = COALESCE(_djomy_ref, djomy_ref),
           updated_at = now()
     WHERE id = _order_id;

    INSERT INTO public.notifications (user_id, kind, title, body, data, url)
    VALUES (
      _order.user_id,
      'sms_order_' || _mapped::text,
      CASE _mapped WHEN 'failed' THEN 'Recharge SMS échouée' ELSE 'Recharge SMS annulée' END,
      format('Votre commande de %s SMS n''a pas pu être créditée.', _order.qty),
      jsonb_build_object('order_id', _order.id),
      '/profil'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_sms_order_webhook(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_sms_order_webhook(uuid, text, text) TO service_role;
