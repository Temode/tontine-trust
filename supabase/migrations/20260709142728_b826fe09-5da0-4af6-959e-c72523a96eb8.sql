CREATE TABLE IF NOT EXISTS public.auth_otp_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_hash text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('signup', 'recovery')),
  token_hash text,
  provider_message_id text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'consumed')),
  error_message text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.auth_otp_requests TO service_role;

ALTER TABLE public.auth_otp_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_auth_otp_requests_email_purpose_created
  ON public.auth_otp_requests (email_hash, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_otp_requests_expires
  ON public.auth_otp_requests (expires_at);