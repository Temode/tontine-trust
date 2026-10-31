-- ============================================================
-- Chantier 3 — Contrat numérique, signature OTP, export de litige
-- ============================================================

-- 1) group_contracts : modèle par défaut (group_id NULL) + surcharges par groupe
CREATE TABLE IF NOT EXISTS public.group_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  version text NOT NULL,
  body_md text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_group_contracts_group ON public.group_contracts(group_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_contracts_default ON public.group_contracts(is_default, published_at DESC) WHERE group_id IS NULL;

GRANT SELECT ON public.group_contracts TO authenticated;
GRANT ALL ON public.group_contracts TO service_role;

ALTER TABLE public.group_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contracts readable by group members or platform default" ON public.group_contracts;
CREATE POLICY "Contracts readable by group members or platform default"
ON public.group_contracts FOR SELECT TO authenticated
USING (
  group_id IS NULL
  OR public.is_group_member(group_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Contracts insertable by admins or organizers" ON public.group_contracts;
CREATE POLICY "Contracts insertable by admins or organizers"
ON public.group_contracts FOR INSERT TO authenticated
WITH CHECK (
  (group_id IS NULL AND public.has_role(auth.uid(), 'admin'))
  OR (group_id IS NOT NULL AND public.is_group_organizer(group_id, auth.uid()))
);

-- 2) contract_signatures : 1 par membre + contrat
CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.group_contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  hash_sha256 text NOT NULL,
  otp_ref uuid REFERENCES public.phone_otp_challenges(id),
  UNIQUE (contract_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_group ON public.contract_signatures(group_id, user_id);

GRANT SELECT, INSERT ON public.contract_signatures TO authenticated;
GRANT ALL ON public.contract_signatures TO service_role;

ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signatures readable by signer or group organizer" ON public.contract_signatures;
CREATE POLICY "Signatures readable by signer or group organizer"
ON public.contract_signatures FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_group_organizer(group_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- 3) dispute_exports : file d'attente PDF
CREATE TABLE IF NOT EXISTS public.dispute_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  pdf_path text,
  sha256 text,
  signed_url text,
  expires_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispute_exports_status_chk
    CHECK (status IN ('queued','processing','ready','failed'))
);
CREATE INDEX IF NOT EXISTS idx_dispute_exports_group ON public.dispute_exports(group_id, created_at DESC);

GRANT SELECT, INSERT ON public.dispute_exports TO authenticated;
GRANT ALL ON public.dispute_exports TO service_role;

ALTER TABLE public.dispute_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Exports readable by organizers or admin" ON public.dispute_exports;
CREATE POLICY "Exports readable by organizers or admin"
ON public.dispute_exports FOR SELECT TO authenticated
USING (
  requested_by = auth.uid()
  OR public.is_group_organizer(group_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE OR REPLACE FUNCTION public.trg_dispute_exports_touch_updated() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS dispute_exports_touch ON public.dispute_exports;
CREATE TRIGGER dispute_exports_touch
  BEFORE UPDATE ON public.dispute_exports
  FOR EACH ROW EXECUTE FUNCTION public.trg_dispute_exports_touch_updated();

-- 4) Seed du modèle plateforme par défaut s'il n'existe pas encore
INSERT INTO public.group_contracts (group_id, version, body_md, is_default, published_at)
SELECT NULL, '1.0',
$md$# Contrat numérique de solidarité

Entre les membres du groupe ci-dessous, signataires du présent contrat, il est convenu ce qui suit :

## Article 1 — Engagement
Chaque membre s'engage à verser ponctuellement sa cotisation aux échéances définies par le règlement interne du groupe.

## Article 2 — Bénéfice du tour
Chaque membre recevra à son tour, conformément à l'ordre de rotation, la cagnotte constituée des cotisations.

## Article 3 — Défaut de paiement
En cas de défaut de paiement après J+1 ouvré suivant l'échéance, le membre s'expose :
- à une pénalité de retard conformément au règlement interne ;
- à la majoration de la rétention de son propre payout ;
- à l'établissement d'un dossier de litige certifié transmis sur demande à toute autorité compétente.

## Article 4 — Caution
Pour les groupes l'exigeant, la caution déposée par les nouveaux membres garantit la bonne fin du cycle.

## Article 5 — Litige
Tout litige sera tranché en premier ressort par la médiation Tontine Digitale.
$md$, true, now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.group_contracts WHERE group_id IS NULL AND is_default = true
);

-- 5) get_active_contract : surcharge groupe → modèle plateforme par défaut
CREATE OR REPLACE FUNCTION public.get_active_contract(_group_id uuid)
RETURNS TABLE (
  contract_id uuid,
  group_id uuid,
  version text,
  body_md text,
  is_default boolean,
  published_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  RETURN QUERY
    SELECT c.id, c.group_id, c.version, c.body_md, c.is_default, c.published_at
    FROM public.group_contracts c
    WHERE c.group_id = _group_id
    ORDER BY c.published_at DESC
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY
      SELECT c.id, c.group_id, c.version, c.body_md, c.is_default, c.published_at
      FROM public.group_contracts c
      WHERE c.group_id IS NULL AND c.is_default = true
      ORDER BY c.published_at DESC
      LIMIT 1;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.get_active_contract(uuid) TO authenticated;

-- 6) admin_publish_contract_template (modèle plateforme uniquement)
CREATE OR REPLACE FUNCTION public.admin_publish_contract_template(
  _version text,
  _body_md text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _version IS NULL OR length(trim(_version)) < 1 THEN RAISE EXCEPTION 'VERSION_REQUIRED'; END IF;
  IF _body_md IS NULL OR length(trim(_body_md)) < 50 THEN RAISE EXCEPTION 'BODY_TOO_SHORT'; END IF;

  INSERT INTO public.group_contracts (group_id, version, body_md, is_default, created_by)
  VALUES (NULL, _version, _body_md, true, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'contract_template_published', 'group_contract', v_id,
    jsonb_build_object('version', _version, 'length', length(_body_md)));

  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_publish_contract_template(text, text) TO authenticated;

-- 7) sign_contract : enregistre la signature après OTP SMS validé
CREATE OR REPLACE FUNCTION public.sign_contract(
  _group_id uuid,
  _otp_challenge_id uuid,
  _hash_sha256 text,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_contract record;
  v_otp record;
  v_sig_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _hash_sha256 IS NULL OR length(_hash_sha256) <> 64 THEN RAISE EXCEPTION 'INVALID_HASH'; END IF;
  IF NOT public.is_group_member(_group_id, v_user)
     AND NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id=_group_id AND user_id=v_user) THEN
    RAISE EXCEPTION 'NOT_A_MEMBER';
  END IF;

  SELECT * INTO v_contract FROM public.get_active_contract(_group_id);
  IF v_contract.contract_id IS NULL THEN RAISE EXCEPTION 'CONTRACT_NOT_FOUND'; END IF;

  SELECT * INTO v_otp FROM public.phone_otp_challenges
   WHERE id = _otp_challenge_id AND user_id = v_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'OTP_NOT_FOUND'; END IF;
  IF v_otp.consumed_at IS NULL THEN RAISE EXCEPTION 'OTP_NOT_VERIFIED'; END IF;
  IF v_otp.consumed_at < now() - interval '15 minutes' THEN RAISE EXCEPTION 'OTP_EXPIRED'; END IF;

  INSERT INTO public.contract_signatures (
    contract_id, user_id, group_id, ip, user_agent, hash_sha256, otp_ref
  ) VALUES (
    v_contract.contract_id, v_user, _group_id,
    _ip, left(coalesce(_user_agent,''), 500), lower(_hash_sha256), _otp_challenge_id
  )
  ON CONFLICT (contract_id, user_id) DO UPDATE
    SET signed_at = now(),
        ip = EXCLUDED.ip,
        user_agent = EXCLUDED.user_agent,
        hash_sha256 = EXCLUDED.hash_sha256,
        otp_ref = EXCLUDED.otp_ref
  RETURNING id INTO v_sig_id;

  INSERT INTO public.audit_log (actor_user_id, group_id, action, entity_type, entity_id, metadata)
  VALUES (v_user, _group_id, 'contract_signed', 'contract_signature', v_sig_id,
    jsonb_build_object('contract_id', v_contract.contract_id, 'version', v_contract.version));

  RETURN v_sig_id;
END $$;
GRANT EXECUTE ON FUNCTION public.sign_contract(uuid, uuid, text, text, text) TO authenticated;

-- 8) start_cycle : bloque si au moins 1 membre actif n'a pas signé
CREATE OR REPLACE FUNCTION public.start_cycle(_group_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_group public.groups%ROWTYPE;
  v_count int;
  v_cycle_id uuid;
  v_cycle_number int;
  v_freq_days int;
  v_payout bigint;
  v_due date;
  v_contract record;
  v_unsigned int;
  r RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_group FROM public.groups WHERE id = _group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'GROUP_NOT_FOUND'; END IF;
  IF NOT public.is_group_organizer(_group_id, v_user) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF v_group.status NOT IN ('draft','open') THEN RAISE EXCEPTION 'CYCLE_ALREADY_STARTED'; END IF;

  SELECT count(*) INTO v_count FROM public.group_members
    WHERE group_id = _group_id AND status = 'active';
  IF v_count < 2 THEN RAISE EXCEPTION 'QUORUM_NOT_REACHED'; END IF;

  -- Garde-fou : tous les membres actifs doivent avoir signé le contrat actif
  SELECT * INTO v_contract FROM public.get_active_contract(_group_id);
  IF v_contract.contract_id IS NULL THEN RAISE EXCEPTION 'CONTRACT_NOT_FOUND'; END IF;
  SELECT COUNT(*) INTO v_unsigned
  FROM public.group_members gm
  WHERE gm.group_id = _group_id AND gm.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.contract_signatures cs
      WHERE cs.contract_id = v_contract.contract_id AND cs.user_id = gm.user_id
    );
  IF v_unsigned > 0 THEN RAISE EXCEPTION 'CONTRACT_NOT_SIGNED'; END IF;

  IF v_group.rotation_order_kind = 'random' THEN
    WITH shuffled AS (
      SELECT id, row_number() OVER (ORDER BY random()) AS rn
      FROM public.group_members
      WHERE group_id = _group_id AND status = 'active'
    )
    UPDATE public.group_members gm SET position = s.rn
    FROM shuffled s WHERE gm.id = s.id;
  ELSE
    WITH ordered AS (
      SELECT id, row_number() OVER (
        ORDER BY position NULLS LAST, joined_at
      ) AS rn
      FROM public.group_members
      WHERE group_id = _group_id AND status = 'active'
    )
    UPDATE public.group_members gm SET position = o.rn
    FROM ordered o WHERE gm.id = o.id;
  END IF;

  SELECT coalesce(max(cycle_number), 0) + 1 INTO v_cycle_number
    FROM public.cycles WHERE group_id = _group_id;

  INSERT INTO public.cycles (group_id, cycle_number, started_at)
  VALUES (_group_id, v_cycle_number, now())
  RETURNING id INTO v_cycle_id;

  v_freq_days := public.frequency_to_days(v_group.frequency);
  IF v_freq_days IS NULL THEN v_freq_days := 7; END IF;
  v_payout := v_group.contribution_amount * v_count;
  v_due := current_date + v_freq_days;

  FOR r IN
    SELECT user_id, position FROM public.group_members
    WHERE group_id = _group_id AND status = 'active'
    ORDER BY position
  LOOP
    INSERT INTO public.turns (
      cycle_id, group_id, beneficiary_user_id,
      turn_number, due_date, payout_amount, status
    ) VALUES (
      v_cycle_id, _group_id, r.user_id, r.position, v_due, v_payout,
      (CASE WHEN r.position = 1 THEN 'collecting' ELSE 'upcoming' END)::public.turn_status
    );
    IF r.position = 1 THEN
      INSERT INTO public.contributions (
        turn_id, group_id, payer_user_id, amount, status
      )
      SELECT
        (SELECT id FROM public.turns WHERE cycle_id = v_cycle_id AND turn_number = 1),
        _group_id, gm.user_id, v_group.contribution_amount, 'pending'::public.contribution_status
      FROM public.group_members gm
      WHERE gm.group_id = _group_id AND gm.status = 'active' AND gm.user_id <> r.user_id;
    END IF;
    v_due := v_due + v_freq_days;
  END LOOP;

  PERFORM set_config('app.via_rpc', '1', TRUE);
  UPDATE public.groups SET status = 'active' WHERE id = _group_id;

  INSERT INTO public.notifications (user_id, kind, title, body, group_id)
  SELECT gm.user_id, 'cycle_started'::public.notification_kind,
    'Cycle démarré',
    'L''ordre de rotation a été tiré. Premier tour ouvert à la collecte.',
    _group_id
  FROM public.group_members gm
  WHERE gm.group_id = _group_id AND gm.status = 'active';

  RETURN v_cycle_id;
END $$;
GRANT EXECUTE ON FUNCTION public.start_cycle(uuid) TO authenticated;

-- 9) request_dispute_export : crée la file d'attente
CREATE OR REPLACE FUNCTION public.request_dispute_export(
  _group_id uuid,
  _member_id uuid,
  _reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 20 THEN RAISE EXCEPTION 'REASON_TOO_SHORT'; END IF;
  IF NOT public.is_group_organizer(_group_id, v_user)
     AND NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id=_group_id AND user_id=_member_id
  ) THEN
    RAISE EXCEPTION 'MEMBER_NOT_IN_GROUP';
  END IF;

  INSERT INTO public.dispute_exports (group_id, member_id, requested_by, reason, status)
  VALUES (_group_id, _member_id, v_user, _reason, 'queued')
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_user_id, group_id, action, entity_type, entity_id, metadata)
  VALUES (v_user, _group_id, 'dispute_export_requested', 'dispute_export', v_id,
    jsonb_build_object('member_id', _member_id, 'reason_length', length(_reason)));

  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.request_dispute_export(uuid, uuid, text) TO authenticated;

-- 10) admin_complete_dispute_export : appelé par l'edge function (service-role)
CREATE OR REPLACE FUNCTION public.admin_complete_dispute_export(
  _id uuid,
  _status text,
  _pdf_path text DEFAULT NULL,
  _sha256 text DEFAULT NULL,
  _signed_url text DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL,
  _error text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _status NOT IN ('queued','processing','ready','failed') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;
  UPDATE public.dispute_exports
    SET status = _status,
        pdf_path = COALESCE(_pdf_path, pdf_path),
        sha256 = COALESCE(_sha256, sha256),
        signed_url = COALESCE(_signed_url, signed_url),
        expires_at = COALESCE(_expires_at, expires_at),
        error_message = _error
    WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_complete_dispute_export(uuid, text, text, text, text, timestamptz, text) TO service_role;