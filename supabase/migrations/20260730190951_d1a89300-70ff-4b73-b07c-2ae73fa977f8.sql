CREATE OR REPLACE FUNCTION public.admin_withdrawal_consistency_check()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  balances_withdrawn bigint,
  completed_requests bigint,
  delta bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  WITH bb AS (
    SELECT b.user_id AS uid, COALESCE(SUM(b.total_withdrawn), 0)::bigint AS w
    FROM public.beneficiary_balances b GROUP BY b.user_id
  ),
  wr AS (
    SELECT r.user_id AS uid, COALESCE(SUM(r.amount), 0)::bigint AS w
    FROM public.user_withdrawal_requests r WHERE r.status = 'completed' GROUP BY r.user_id
  ),
  merged AS (
    SELECT COALESCE(bb.uid, wr.uid) AS uid,
           COALESCE(bb.w, 0)::bigint AS bw,
           COALESCE(wr.w, 0)::bigint AS cw
    FROM bb FULL OUTER JOIN wr ON wr.uid = bb.uid
  )
  SELECT m.uid, p.full_name, m.bw, m.cw, (m.bw - m.cw)::bigint
  FROM merged m
  LEFT JOIN public.profiles p ON p.id = m.uid
  WHERE m.bw <> m.cw
  ORDER BY ABS(m.bw - m.cw) DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_withdrawal_consistency_check() TO authenticated;