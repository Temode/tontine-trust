
-- =====================================================================
-- 52_defaulted_status — Étape 1 : enums, colonnes, tables
-- =====================================================================

-- 1) Nouvelles valeurs d'enum
ALTER TYPE public.contribution_status ADD VALUE IF NOT EXISTS 'defaulted';
ALTER TYPE public.reliability_tier ADD VALUE IF NOT EXISTS 'blocked';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'contribution_defaulted';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'defaulter_reported';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'defaulter_report_resolved';

-- 2) Colonnes défaut sur contributions
ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS defaulted_at timestamptz,
  ADD COLUMN IF NOT EXISTS default_days int NOT NULL DEFAULT 0;

-- 3) Permission « signaler un défaillant » pour les organisateurs
ALTER TABLE public.group_admin_permissions
  ADD COLUMN IF NOT EXISTS can_report_defaulter boolean NOT NULL DEFAULT true;

-- 4) Préparation KYC sur profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_status') THEN
    CREATE TYPE public.kyc_status AS ENUM ('none', 'pending', 'verified', 'rejected');
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status public.kyc_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS kyc_verified_at timestamptz;

-- 5) Table member_default_reports (signalements officiels Tontine)
CREATE TABLE IF NOT EXISTS public.member_default_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES auth.users(id),
  contribution_id uuid REFERENCES public.contributions(id) ON DELETE SET NULL,
  reason text,
  status text NOT NULL DEFAULT 'open',
  tontine_handler_id uuid REFERENCES auth.users(id),
  internal_notes text,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT default_report_status_check CHECK (status IN ('open','in_review','resolved','legal_action','dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_mdr_status ON public.member_default_reports(status);
CREATE INDEX IF NOT EXISTS idx_mdr_group ON public.member_default_reports(group_id);
CREATE INDEX IF NOT EXISTS idx_mdr_user ON public.member_default_reports(reported_user_id);

GRANT SELECT, INSERT, UPDATE ON public.member_default_reports TO authenticated;
GRANT ALL ON public.member_default_reports TO service_role;
ALTER TABLE public.member_default_reports ENABLE ROW LEVEL SECURITY;

-- Lecture : super-admin plateforme + organisateurs du groupe + le membre concerné
CREATE POLICY "mdr_select" ON public.member_default_reports
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR reported_user_id = auth.uid()
  OR reported_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_admin_permissions p
    WHERE p.group_id = member_default_reports.group_id AND p.user_id = auth.uid()
  )
);

-- Insert : via RPC uniquement
CREATE POLICY "mdr_no_direct_insert" ON public.member_default_reports
FOR INSERT TO authenticated WITH CHECK (false);

-- Update : super-admin uniquement
CREATE POLICY "mdr_update_admin" ON public.member_default_reports
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_mdr_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_mdr_updated ON public.member_default_reports;
CREATE TRIGGER trg_mdr_updated BEFORE UPDATE ON public.member_default_reports
FOR EACH ROW EXECUTE FUNCTION public.touch_mdr_updated_at();

-- 6) Table kyc_documents (scaffolding, upload utilisateur dans un plan dédié)
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('id_card','passport','residence_certificate','selfie','other')),
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_user ON public.kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON public.kyc_documents(status);

GRANT SELECT, INSERT ON public.kyc_documents TO authenticated;
GRANT ALL ON public.kyc_documents TO service_role;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kyc_select_self_or_admin" ON public.kyc_documents
FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "kyc_insert_self" ON public.kyc_documents
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_kyc_updated ON public.kyc_documents;
CREATE TRIGGER trg_kyc_updated BEFORE UPDATE ON public.kyc_documents
FOR EACH ROW EXECUTE FUNCTION public.touch_mdr_updated_at();
