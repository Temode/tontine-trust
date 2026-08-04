
-- 1) Table
CREATE TABLE IF NOT EXISTS public.payment_pause_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  contribution_id uuid NOT NULL REFERENCES public.contributions(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','consumed','expired')),
  decided_by uuid,
  decided_at timestamptz,
  decision_reason text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppr_group ON public.payment_pause_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_ppr_contribution ON public.payment_pause_requests(contribution_id);
CREATE INDEX IF NOT EXISTS idx_ppr_requester ON public.payment_pause_requests(requested_by);

GRANT SELECT ON public.payment_pause_requests TO authenticated;
GRANT ALL ON public.payment_pause_requests TO service_role;

ALTER TABLE public.payment_pause_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ppr_select ON public.payment_pause_requests;
CREATE POLICY ppr_select ON public.payment_pause_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.is_group_organizer(group_id, auth.uid())
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.trg_ppr_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS ppr_touch ON public.payment_pause_requests;
CREATE TRIGGER ppr_touch BEFORE UPDATE ON public.payment_pause_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_ppr_touch();

-- 2) RPC: request_payment_during_pause(_contribution_id)
CREATE OR REPLACE FUNCTION public.request_payment_during_pause(_contribution_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_contrib public.contributions%rowtype;
  v_group public.groups%rowtype;
  v_request_id uuid;
  v_organizer_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_contrib FROM public.contributions WHERE id = _contribution_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTRIBUTION_NOT_FOUND'; END IF;
  IF v_contrib.payer_user_id <> v_user THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF v_contrib.status = 'confirmed' THEN RAISE EXCEPTION 'ALREADY_PAID'; END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = v_contrib.group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'GROUP_NOT_FOUND'; END IF;
  IF v_group.status <> 'paused' THEN RAISE EXCEPTION 'GROUP_NOT_PAUSED'; END IF;

  -- Reuse pending request if exists
  SELECT id INTO v_request_id FROM public.payment_pause_requests
   WHERE contribution_id = _contribution_id
     AND requested_by = v_user
     AND status = 'pending'
   LIMIT 1;

  IF v_request_id IS NULL THEN
    INSERT INTO public.payment_pause_requests (group_id, contribution_id, requested_by)
    VALUES (v_contrib.group_id, _contribution_id, v_user)
    RETURNING id INTO v_request_id;
  END IF;

  v_organizer_id := v_group.created_by;

  INSERT INTO public.notifications (user_id, kind, title, body, group_id, data)
  VALUES (
    v_organizer_id,
    'payment_pause_request_created',
    'Demande de paiement durant la pause',
    'Un membre demande l''autorisation de régler sa cotisation pendant la pause du cycle.',
    v_contrib.group_id,
    jsonb_build_object(
      'request_id', v_request_id,
      'contribution_id', _contribution_id,
      'requested_by', v_user
    )
  );

  RETURN v_request_id;
END $$;

GRANT EXECUTE ON FUNCTION public.request_payment_during_pause(uuid) TO authenticated;

-- 3) RPC: decide_payment_pause_request(_request_id, _approve, _reason)
CREATE OR REPLACE FUNCTION public.decide_payment_pause_request(
  _request_id uuid, _approve boolean, _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_req public.payment_pause_requests%rowtype;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_req FROM public.payment_pause_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
  IF NOT public.is_group_organizer(v_req.group_id, v_user) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'ALREADY_DECIDED'; END IF;

  UPDATE public.payment_pause_requests
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         decided_by = v_user,
         decided_at = now(),
         decision_reason = _reason
   WHERE id = _request_id;

  INSERT INTO public.notifications (user_id, kind, title, body, group_id, data)
  VALUES (
    v_req.requested_by,
    CASE WHEN _approve THEN 'payment_pause_request_approved' ELSE 'payment_pause_request_rejected' END,
    CASE WHEN _approve THEN 'Autorisation de paiement accordée' ELSE 'Demande de paiement refusée' END,
    CASE WHEN _approve
         THEN 'Vous pouvez maintenant régler votre cotisation malgré la pause du cycle.'
         ELSE COALESCE(_reason, 'L''organisateur a refusé votre demande de paiement durant la pause.')
    END,
    v_req.group_id,
    jsonb_build_object('request_id', _request_id, 'contribution_id', v_req.contribution_id, 'approved', _approve)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.decide_payment_pause_request(uuid, boolean, text) TO authenticated;

-- 4) Renforcer start_djomy_payment : autorisation requise pendant la pause
CREATE OR REPLACE FUNCTION public.start_djomy_payment(
  _contribution_id uuid,
  _method text DEFAULT NULL,
  _payer_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_contrib public.contributions%rowtype;
  v_group public.groups%rowtype;
  v_payment_id uuid;
  v_auth_req_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_contrib FROM public.contributions WHERE id = _contribution_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTRIBUTION_NOT_FOUND'; END IF;
  IF v_contrib.payer_user_id <> v_user THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF v_contrib.status = 'confirmed' THEN RAISE EXCEPTION 'ALREADY_PAID'; END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = v_contrib.group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'GROUP_NOT_FOUND'; END IF;
  IF v_group.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'GROUP_DELETED'; END IF;
  IF v_group.archived_at IS NOT NULL THEN RAISE EXCEPTION 'GROUP_ARCHIVED'; END IF;
  IF v_group.status IN ('completed', 'cancelled') THEN RAISE EXCEPTION 'GROUP_NOT_ACTIVE'; END IF;

  IF v_group.status = 'paused' THEN
    SELECT id INTO v_auth_req_id
      FROM public.payment_pause_requests
     WHERE contribution_id = _contribution_id
       AND requested_by = v_user
       AND status = 'approved'
       AND expires_at > now()
     ORDER BY decided_at DESC NULLS LAST
     LIMIT 1;
    IF v_auth_req_id IS NULL THEN RAISE EXCEPTION 'GROUP_PAUSED'; END IF;
    UPDATE public.payment_pause_requests SET status = 'consumed' WHERE id = v_auth_req_id;
  END IF;

  INSERT INTO public.payments (
    contribution_id, group_id, user_id, amount, provider,
    status, payment_method, payer_phone, initiated_at
  )
  VALUES (
    v_contrib.id, v_contrib.group_id, v_user, v_contrib.amount, 'djomy',
    'initiated', _method, _payer_phone, now()
  )
  RETURNING id INTO v_payment_id;
  RETURN v_payment_id;
END $$;

GRANT EXECUTE ON FUNCTION public.start_djomy_payment(uuid, text, text) TO authenticated;

-- 5) Realtime
ALTER TABLE public.payment_pause_requests REPLICA IDENTITY FULL;
ALTER TABLE public.groups REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_pause_requests;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
