CREATE TABLE public.sms_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  turn_id UUID REFERENCES public.turns(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  recipient_normalized TEXT,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'nimba',
  provider_message_id TEXT,
  provider_cost NUMERIC,
  error TEXT,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sms_logs_created_at_idx ON public.sms_logs (created_at DESC);
CREATE INDEX sms_logs_user_id_idx ON public.sms_logs (user_id);
CREATE INDEX sms_logs_group_id_idx ON public.sms_logs (group_id);
CREATE INDEX sms_logs_kind_idx ON public.sms_logs (kind);

GRANT SELECT ON public.sms_logs TO authenticated;
GRANT ALL ON public.sms_logs TO service_role;

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_logs_select_self_or_admin"
  ON public.sms_logs FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR triggered_by = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );