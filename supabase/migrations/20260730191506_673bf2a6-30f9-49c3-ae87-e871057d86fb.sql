-- 1. Tables
CREATE TABLE IF NOT EXISTS public.balance_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  users_checked integer NOT NULL DEFAULT 0,
  discrepancies integer NOT NULL DEFAULT 0,
  triggered_by uuid,
  source text NOT NULL DEFAULT 'cron',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.balance_reconciliation_runs TO authenticated;
GRANT ALL ON public.balance_reconciliation_runs TO service_role;
ALTER TABLE public.balance_reconciliation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recon_runs_admin_read" ON public.balance_reconciliation_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS public.balance_reconciliation_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.balance_reconciliation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  code text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  expected_amount bigint NOT NULL DEFAULT 0,
  actual_amount bigint NOT NULL DEFAULT 0,
  delta bigint NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brf_open_idx ON public.balance_reconciliation_findings (resolved_at, created_at DESC);
CREATE INDEX IF NOT EXISTS brf_user_idx ON public.balance_reconciliation_findings (user_id, created_at DESC);

GRANT SELECT ON public.balance_reconciliation_findings TO authenticated;
GRANT ALL ON public.balance_reconciliation_findings TO service_role;
ALTER TABLE public.balance_reconciliation_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recon_findings_admin_read" ON public.balance_reconciliation_findings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.tg_brf_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_brf_touch BEFORE UPDATE ON public.balance_reconciliation_findings
  FOR EACH ROW EXECUTE FUNCTION public.tg_brf_touch();

-- 2. Moteur de réconciliation
CREATE OR REPLACE FUNCTION public.run_balance_reconciliation(_source text DEFAULT 'cron')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_run uuid;
  v_users integer := 0;
  v_found integer := 0;
BEGIN
  IF v_uid IS NOT NULL
     AND NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  INSERT INTO public.balance_reconciliation_runs (triggered_by, source)
  VALUES (v_uid, COALESCE(_source, 'cron'))
  RETURNING id INTO v_run;

  WITH bb AS (
    SELECT b.user_id AS uid,
           COALESCE(SUM(b.total_credited), 0)::bigint AS credited,
           COALESCE(SUM(b.total_withdrawn), 0)::bigint AS withdrawn,
           COALESCE(SUM(b.available_amount), 0)::bigint AS available
    FROM public.beneficiary_balances b
    GROUP BY b.user_id
  ),
  wr AS (
    SELECT r.user_id AS uid,
           COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'completed'), 0)::bigint AS completed,
           COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'pending'), 0)::bigint AS pending,
           COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'rejected'), 0)::bigint AS rejected
    FROM public.user_withdrawal_requests r
    GROUP BY r.user_id
  ),
  merged AS (
    SELECT COALESCE(bb.uid, wr.uid) AS uid,
           COALESCE(bb.credited, 0) AS credited,
           COALESCE(bb.withdrawn, 0) AS withdrawn,
           COALESCE(bb.available, 0) AS available,
           COALESCE(wr.completed, 0) AS completed,
           COALESCE(wr.pending, 0) AS pending,
           COALESCE(wr.rejected, 0) AS rejected
    FROM bb FULL OUTER JOIN wr ON wr.uid = bb.uid
  ),
  counted AS (
    SELECT COUNT(*)::int AS n FROM merged
  ),
  inserted AS (
    INSERT INTO public.balance_reconciliation_findings
      (run_id, user_id, code, severity, expected_amount, actual_amount, delta, details)
    SELECT v_run, m.uid, f.code, f.severity, f.expected, f.actual, (f.actual - f.expected),
           jsonb_build_object(
             'credited', m.credited,
             'withdrawn', m.withdrawn,
             'available', m.available,
             'completed_requests', m.completed,
             'pending_requests', m.pending,
             'rejected_requests', m.rejected
           )
    FROM merged m
    CROSS JOIN LATERAL (
      VALUES
        ('withdrawn_mismatch', 'critical', m.completed, m.withdrawn),
        ('available_mismatch', 'warning', GREATEST(m.credited - m.withdrawn, 0), m.available),
        ('over_withdrawn', 'critical', m.credited, m.withdrawn + m.pending)
    ) AS f(code, severity, expected, actual)
    WHERE (f.code <> 'over_withdrawn' AND f.actual <> f.expected)
       OR (f.code = 'over_withdrawn' AND f.actual > f.expected)
    RETURNING 1
  )
  SELECT (SELECT n FROM counted), (SELECT COUNT(*)::int FROM inserted)
  INTO v_users, v_found;

  UPDATE public.balance_reconciliation_runs
  SET finished_at = now(), users_checked = v_users, discrepancies = v_found
  WHERE id = v_run;

  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (v_uid, 'balance_reconciliation_run', 'balance_reconciliation_runs', v_run,
          jsonb_build_object('users_checked', v_users, 'discrepancies', v_found, 'source', COALESCE(_source, 'cron')));

  RETURN v_run;
END $$;

GRANT EXECUTE ON FUNCTION public.run_balance_reconciliation(text) TO authenticated;

-- 3. Lecture / résumé / clôture
CREATE OR REPLACE FUNCTION public.admin_list_reconciliation_findings(
  _only_open boolean DEFAULT true,
  _limit integer DEFAULT 200
)
RETURNS TABLE(
  id uuid,
  run_id uuid,
  user_id uuid,
  full_name text,
  code text,
  severity text,
  expected_amount bigint,
  actual_amount bigint,
  delta bigint,
  details jsonb,
  resolved_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  SELECT f.id, f.run_id, f.user_id, p.full_name, f.code, f.severity,
         f.expected_amount, f.actual_amount, f.delta, f.details, f.resolved_at, f.created_at
  FROM public.balance_reconciliation_findings f
  LEFT JOIN public.profiles p ON p.id = f.user_id
  WHERE (NOT _only_open OR f.resolved_at IS NULL)
  ORDER BY f.created_at DESC, ABS(f.delta) DESC
  LIMIT GREATEST(COALESCE(_limit, 200), 1);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_list_reconciliation_findings(boolean, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reconciliation_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_res jsonb;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT jsonb_build_object(
    'open_count', (SELECT COUNT(*) FROM public.balance_reconciliation_findings WHERE resolved_at IS NULL),
    'critical_count', (SELECT COUNT(*) FROM public.balance_reconciliation_findings WHERE resolved_at IS NULL AND severity = 'critical'),
    'withdrawn_mismatch_count', (SELECT COUNT(*) FROM public.balance_reconciliation_findings WHERE resolved_at IS NULL AND code = 'withdrawn_mismatch'),
    'max_abs_delta', (SELECT COALESCE(MAX(ABS(delta)), 0) FROM public.balance_reconciliation_findings WHERE resolved_at IS NULL),
    'last_run_at', (SELECT MAX(finished_at) FROM public.balance_reconciliation_runs)
  ) INTO v_res;

  RETURN v_res;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_reconciliation_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_reconciliation_finding(_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.balance_reconciliation_findings
  SET resolved_at = now(),
      resolved_by = v_uid,
      details = details || jsonb_build_object('resolution_note', _note)
  WHERE id = _id AND resolved_at IS NULL;

  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (v_uid, 'reconciliation_finding_resolved', 'balance_reconciliation_findings', _id,
          jsonb_build_object('note', _note));
END $$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_reconciliation_finding(uuid, text) TO authenticated;

-- 4. Journal d'audit détaillé par utilisateur
CREATE OR REPLACE FUNCTION public.admin_user_balance_journal(_user_id uuid, _limit integer DEFAULT 300)
RETURNS TABLE(
  occurred_at timestamptz,
  kind text,
  label text,
  direction text,
  amount bigint,
  reference uuid,
  metadata jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL
     OR (v_uid <> _user_id
         AND NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin'))) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  SELECT * FROM (
    -- Crédits et mouvements de groupe
    SELECT le.created_at AS occurred_at,
           'ledger'::text AS kind,
           le.entry_type::text AS label,
           CASE WHEN le.entry_type IN ('payout_out', 'fee', 'penalty') THEN 'out' ELSE 'in' END::text AS direction,
           le.amount::bigint AS amount,
           le.id AS reference,
           jsonb_build_object('group_id', le.group_id, 'memo', le.memo) AS metadata
    FROM public.ledger_entries le
    WHERE le.user_id = _user_id

    UNION ALL

    -- Demandes de retrait (tous statuts)
    SELECT COALESCE(r.processed_at, r.created_at),
           'withdrawal'::text,
           ('withdrawal_' || r.status::text)::text,
           CASE WHEN r.status = 'completed' THEN 'out' WHEN r.status = 'rejected' THEN 'in' ELSE 'hold' END::text,
           r.amount::bigint,
           r.id,
           jsonb_build_object(
             'status', r.status,
             'method', r.payment_method,
             'fee_amount', r.fee_amount,
             'net_amount', r.net_amount,
             'rejection_reason', r.rejection_reason,
             'requested_at', r.created_at
           )
    FROM public.user_withdrawal_requests r
    WHERE r.user_id = _user_id

    UNION ALL

    -- Frais et écritures plateforme rattachées à l'utilisateur
    SELECT pl.created_at,
           'platform'::text,
           pl.category::text,
           pl.direction::text,
           pl.amount::bigint,
           pl.id,
           jsonb_build_object('compartment', pl.compartment, 'memo', pl.memo, 'withdrawal_id', pl.withdrawal_id)
    FROM public.platform_ledger pl
    WHERE pl.user_id = _user_id

    UNION ALL

    -- Corrections / annulations administratives
    SELECT a.created_at,
           'audit'::text,
           a.action::text,
           'info'::text,
           COALESCE((a.metadata->>'amount')::bigint, 0),
           a.entity_id,
           a.metadata
    FROM public.audit_log a
    WHERE a.entity_id = _user_id
       OR (a.metadata->>'user_id') = _user_id::text
  ) j
  ORDER BY j.occurred_at DESC
  LIMIT GREATEST(COALESCE(_limit, 300), 1);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_user_balance_journal(uuid, integer) TO authenticated;

-- 5. Planification quotidienne
SELECT cron.unschedule('balance-reconciliation-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'balance-reconciliation-daily');

SELECT cron.schedule(
  'balance-reconciliation-daily',
  '15 3 * * *',
  $$SELECT public.run_balance_reconciliation('cron');$$
);