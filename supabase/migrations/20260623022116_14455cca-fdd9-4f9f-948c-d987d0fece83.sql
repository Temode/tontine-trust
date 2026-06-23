CREATE TABLE IF NOT EXISTS public.phone_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  code_hash text NOT NULL,
  attempts smallint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_otp_user ON public.phone_otp_challenges(user_id, created_at DESC);

GRANT ALL ON public.phone_otp_challenges TO service_role;
ALTER TABLE public.phone_otp_challenges ENABLE ROW LEVEL SECURITY;
-- Pas de policy : seul service_role (edge functions) y accède.