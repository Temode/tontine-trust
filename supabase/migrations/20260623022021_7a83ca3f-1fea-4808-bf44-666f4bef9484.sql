-- =====================================================================
-- Chantier 1 — KYC à paliers (Parcours de confiance)
-- =====================================================================

-- 1) Plafond par palier
CREATE TABLE IF NOT EXISTS public.kyc_levels_config (
  level smallint PRIMARY KEY CHECK (level BETWEEN 0 AND 2),
  label text NOT NULL,
  max_contribution_amount bigint NOT NULL CHECK (max_contribution_amount >= 0),
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.kyc_levels_config TO anon, authenticated;
GRANT ALL ON public.kyc_levels_config TO service_role;
ALTER TABLE public.kyc_levels_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc_cfg_read_all" ON public.kyc_levels_config;
CREATE POLICY "kyc_cfg_read_all" ON public.kyc_levels_config
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "kyc_cfg_admin_write" ON public.kyc_levels_config;
CREATE POLICY "kyc_cfg_admin_write" ON public.kyc_levels_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kyc_levels_config (level, label, max_contribution_amount, description) VALUES
  (0, 'Non vérifié', 0,                    'Aucune adhésion possible — vérifiez votre téléphone.'),
  (1, 'Découverte',  50000,                'Téléphone validé par OTP SMS. Tontines jusqu''à 50 000 GNF/cotisation.'),
  (2, 'Vérifié',     9223372036854775807,  'Pièce d''identité validée. Aucune limite de montant.')
ON CONFLICT (level) DO NOTHING;

-- 2) Profils
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_level smallint NOT NULL DEFAULT 0
    CHECK (kyc_level BETWEEN 0 AND 2),
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

-- 3) Pièces acceptées
ALTER TABLE public.kyc_documents
  DROP CONSTRAINT IF EXISTS kyc_documents_doc_type_check;
ALTER TABLE public.kyc_documents
  ADD CONSTRAINT kyc_documents_doc_type_check
  CHECK (doc_type IN ('nina','passport','voter_card','driver_license','consular_card','id_card','residence_certificate','selfie','other'));

ALTER TABLE public.kyc_documents
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS country_code text DEFAULT 'GN',
  ADD COLUMN IF NOT EXISTS target_level smallint NOT NULL DEFAULT 2 CHECK (target_level BETWEEN 1 AND 2);

-- 4) Politiques storage sur le bucket kyc-documents
DROP POLICY IF EXISTS "kyc_docs_owner_select" ON storage.objects;
CREATE POLICY "kyc_docs_owner_select" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'kyc-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  );

DROP POLICY IF EXISTS "kyc_docs_owner_insert" ON storage.objects;
CREATE POLICY "kyc_docs_owner_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_docs_owner_delete" ON storage.objects;
CREATE POLICY "kyc_docs_owner_delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'kyc-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  );

-- 5) RPC : téléphone vérifié -> palier 1
CREATE OR REPLACE FUNCTION public.mark_phone_verified()
RETURNS smallint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_new_level smallint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  UPDATE public.profiles
    SET phone_verified_at = COALESCE(phone_verified_at, now()),
        kyc_level = GREATEST(kyc_level, 1)
    WHERE id = v_user
    RETURNING kyc_level INTO v_new_level;
  RETURN v_new_level;
END $$;
GRANT EXECUTE ON FUNCTION public.mark_phone_verified() TO authenticated;

-- 6) RPC : soumettre une pièce d'identité
CREATE OR REPLACE FUNCTION public.submit_kyc_document(
  _doc_type text,
  _storage_path text,
  _document_number text DEFAULT NULL,
  _country_code text DEFAULT 'GN'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _doc_type NOT IN ('nina','passport','voter_card','driver_license','consular_card') THEN
    RAISE EXCEPTION 'INVALID_DOC_TYPE';
  END IF;
  IF _storage_path IS NULL OR _storage_path = '' THEN
    RAISE EXCEPTION 'STORAGE_PATH_REQUIRED';
  END IF;

  INSERT INTO public.kyc_documents (user_id, doc_type, storage_path, document_number, country_code, target_level, status)
  VALUES (v_user, _doc_type, _storage_path, _document_number, _country_code, 2, 'pending')
  RETURNING id INTO v_id;

  UPDATE public.profiles
    SET kyc_status = 'pending'
    WHERE id = v_user AND kyc_status IN ('none','rejected');

  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.submit_kyc_document(text,text,text,text) TO authenticated;

-- 7) RPC : décision admin
CREATE OR REPLACE FUNCTION public.admin_validate_kyc(
  _document_id uuid,
  _approve boolean,
  _note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid(); v_doc public.kyc_documents%rowtype;
BEGIN
  IF v_admin IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT * INTO v_doc FROM public.kyc_documents WHERE id = _document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOC_NOT_FOUND'; END IF;
  IF v_doc.status <> 'pending' THEN RAISE EXCEPTION 'DOC_ALREADY_REVIEWED'; END IF;

  UPDATE public.kyc_documents
    SET status = CASE WHEN _approve THEN 'verified' ELSE 'rejected' END,
        reviewed_by = v_admin,
        reviewed_at = now(),
        review_note = _note
    WHERE id = _document_id;

  IF _approve THEN
    UPDATE public.profiles
      SET kyc_level = GREATEST(kyc_level, v_doc.target_level),
          kyc_status = 'verified',
          kyc_verified_at = now()
      WHERE id = v_doc.user_id;
  ELSE
    UPDATE public.profiles
      SET kyc_status = 'rejected'
      WHERE id = v_doc.user_id;
  END IF;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (
    v_doc.user_id,
    'system'::public.notification_kind,
    CASE WHEN _approve THEN 'Identité vérifiée' ELSE 'Vérification refusée' END,
    CASE WHEN _approve
      THEN 'Vous avez accès au palier Vérifié. Vous pouvez rejoindre toutes les tontines.'
      ELSE COALESCE('Votre document n''a pas été validé : ' || _note, 'Votre document a été refusé.')
    END
  );

  PERFORM public.log_audit(
    NULL,
    CASE WHEN _approve THEN 'kyc_approved' ELSE 'kyc_rejected' END,
    'kyc_document', _document_id,
    jsonb_build_object('user_id', v_doc.user_id, 'doc_type', v_doc.doc_type, 'note', _note)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.admin_validate_kyc(uuid, boolean, text) TO authenticated;

-- 8) Vue file d'attente admin
CREATE OR REPLACE VIEW public.kyc_admin_queue
WITH (security_invoker = true) AS
SELECT d.id AS document_id, d.user_id, p.full_name, p.phone_number,
       p.kyc_level AS current_level, d.doc_type, d.document_number,
       d.country_code, d.target_level, d.storage_path, d.status,
       d.created_at, d.reviewed_by, d.reviewed_at, d.review_note
FROM public.kyc_documents d JOIN public.profiles p ON p.id = d.user_id;

GRANT SELECT ON public.kyc_admin_queue TO authenticated;

-- 9) Garde-fou : join_group_with_code refuse si plafond dépassé
CREATE OR REPLACE FUNCTION public.join_group_with_code(
  _code text,
  _operator text DEFAULT NULL,
  _message text DEFAULT NULL,
  _accepted_terms_version text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invitation public.invitations%rowtype;
  v_visibility public.group_visibility;
  v_user uuid := auth.uid();
  v_count int; v_max int; v_attempt_count int;
  v_target_status public.member_status;
  v_target_position int;
  v_ip_hash text;
  v_kyc_level smallint; v_cap bigint; v_amount bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  IF _accepted_terms_version IS NULL OR _accepted_terms_version = '' THEN
    RAISE EXCEPTION 'TERMS_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_terms_versions WHERE version = _accepted_terms_version) THEN
    RAISE EXCEPTION 'TERMS_VERSION_UNKNOWN';
  END IF;

  SELECT COUNT(*) INTO v_attempt_count
    FROM public.join_attempts
    WHERE user_id = v_user AND attempted_at > now() - interval '10 minutes';
  IF v_attempt_count >= 10 THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
  INSERT INTO public.join_attempts (user_id) VALUES (v_user);

  IF _operator IS NOT NULL AND _operator NOT IN ('orange','mtn') THEN
    RAISE EXCEPTION 'INVALID_OPERATOR';
  END IF;
  IF _message IS NOT NULL AND char_length(_message) > 280 THEN
    RAISE EXCEPTION 'MESSAGE_TOO_LONG';
  END IF;

  SELECT * INTO v_invitation FROM public.invitations WHERE code = _code;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_NOT_FOUND'; END IF;
  IF v_invitation.status <> 'pending' THEN RAISE EXCEPTION 'INVITATION_INACTIVE'; END IF;
  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < now() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = v_invitation.id;
    RAISE EXCEPTION 'INVITATION_EXPIRED';
  END IF;
  IF v_invitation.max_uses IS NOT NULL AND v_invitation.uses_count >= v_invitation.max_uses THEN
    RAISE EXCEPTION 'INVITATION_EXHAUSTED';
  END IF;

  SELECT kyc_level INTO v_kyc_level FROM public.profiles WHERE id = v_user;
  v_kyc_level := COALESCE(v_kyc_level, 0);
  SELECT contribution_amount, max_members, visibility
    INTO v_amount, v_max, v_visibility
    FROM public.groups WHERE id = v_invitation.group_id;
  SELECT max_contribution_amount INTO v_cap
    FROM public.kyc_levels_config WHERE level = v_kyc_level;
  IF v_amount > COALESCE(v_cap, 0) THEN
    RAISE EXCEPTION 'KYC_INSUFFICIENT';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.group_members
    WHERE group_id = v_invitation.group_id AND status = 'active';
  IF v_count >= v_max THEN RAISE EXCEPTION 'GROUP_FULL'; END IF;

  IF v_visibility = 'private' THEN
    v_target_status := 'active';
    v_target_position := v_count + 1;
  ELSE
    v_target_status := 'pending';
    v_target_position := NULL;
  END IF;

  INSERT INTO public.group_members (
    group_id, user_id, role, status, position,
    preferred_operator, applicant_message
  ) VALUES (
    v_invitation.group_id, v_user, 'membre',
    v_target_status, v_target_position,
    _operator, _message
  )
  ON CONFLICT (group_id, user_id) DO UPDATE SET
    status = CASE
      WHEN public.group_members.status IN ('active','pending')
        THEN public.group_members.status
      ELSE excluded.status
    END,
    preferred_operator = COALESCE(excluded.preferred_operator, public.group_members.preferred_operator),
    applicant_message = COALESCE(excluded.applicant_message, public.group_members.applicant_message);

  UPDATE public.invitations SET uses_count = uses_count + 1 WHERE id = v_invitation.id;

  BEGIN
    v_ip_hash := encode(
      digest(COALESCE(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), 'sha256'),
      'hex'
    );
  EXCEPTION WHEN OTHERS THEN v_ip_hash := NULL; END;

  INSERT INTO public.group_consent_log (user_id, group_id, terms_version, ip_hash)
  VALUES (v_user, v_invitation.group_id, _accepted_terms_version, v_ip_hash);

  INSERT INTO public.notifications (user_id, kind, title, body, group_id)
  VALUES (
    v_invitation.created_by,
    'invitation_accepted',
    CASE WHEN v_target_status = 'pending' THEN 'Nouvelle candidature' ELSE 'Nouveau membre' END,
    CASE WHEN v_target_status = 'pending'
      THEN 'Une personne candidate à votre groupe via invitation.'
      ELSE 'Un membre a rejoint votre groupe via invitation.' END,
    v_invitation.group_id
  );

  RETURN v_invitation.group_id;
END $$;

GRANT EXECUTE ON FUNCTION public.join_group_with_code(text, text, text, text) TO authenticated;