
-- 1. RPC start_djomy_payment : refuser si groupe en pause / archivé / clôturé
CREATE OR REPLACE FUNCTION public.start_djomy_payment(
  _contribution_id uuid,
  _method text DEFAULT NULL,
  _payer_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_contrib public.contributions%rowtype;
  v_group public.groups%rowtype;
  v_payment_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_contrib from public.contributions where id = _contribution_id;
  if not found then raise exception 'CONTRIBUTION_NOT_FOUND'; end if;
  if v_contrib.payer_user_id <> v_user then raise exception 'FORBIDDEN'; end if;
  if v_contrib.status = 'confirmed' then raise exception 'ALREADY_PAID'; end if;

  select * into v_group from public.groups where id = v_contrib.group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if v_group.deleted_at is not null then raise exception 'GROUP_DELETED'; end if;
  if v_group.archived_at is not null then raise exception 'GROUP_ARCHIVED'; end if;
  if v_group.status = 'paused' then raise exception 'GROUP_PAUSED'; end if;
  if v_group.status in ('completed', 'cancelled') then raise exception 'GROUP_NOT_ACTIVE'; end if;

  insert into public.payments (
    contribution_id, group_id, user_id, amount, provider,
    status, payment_method, payer_phone, initiated_at
  )
  values (
    v_contrib.id, v_contrib.group_id, v_user, v_contrib.amount, 'djomy',
    'initiated', _method, _payer_phone, now()
  )
  returning id into v_payment_id;
  return v_payment_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.start_djomy_payment(uuid, text, text) TO authenticated;

-- 2. Vue my_contributions_due : masquer les groupes en pause / archivés / supprimés
DROP VIEW IF EXISTS public.my_contributions_due;
CREATE VIEW public.my_contributions_due
WITH (security_invoker = true) AS
SELECT c.id AS contribution_id,
       c.turn_id,
       c.group_id,
       g.name AS group_name,
       c.amount,
       c.status,
       t.turn_number,
       t.due_date,
       t.beneficiary_user_id,
       pb.full_name AS beneficiary_name,
       t.due_date - current_date AS days_to_due,
       CASE
         WHEN g.late_penalty_percent > 0
              AND (current_date - t.due_date) > g.late_penalty_after_days
           THEN c.amount * g.late_penalty_percent / 100
         ELSE 0::bigint
       END AS expected_penalty
FROM public.contributions c
JOIN public.turns t ON t.id = c.turn_id
JOIN public.groups g ON g.id = c.group_id
LEFT JOIN public.profiles pb ON pb.id = t.beneficiary_user_id
WHERE c.payer_user_id = auth.uid()
  AND c.status = ANY (ARRAY['pending'::public.contribution_status,
                            'submitted'::public.contribution_status,
                            'rejected'::public.contribution_status])
  AND t.status = 'collecting'::public.turn_status
  AND g.status NOT IN ('paused','completed','cancelled')
  AND g.deleted_at IS NULL
  AND g.archived_at IS NULL
ORDER BY t.due_date;

GRANT SELECT ON public.my_contributions_due TO authenticated;
