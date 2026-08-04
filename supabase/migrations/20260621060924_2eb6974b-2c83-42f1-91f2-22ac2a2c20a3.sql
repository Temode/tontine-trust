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
  v_payment_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_contrib from public.contributions where id = _contribution_id;
  if not found then raise exception 'CONTRIBUTION_NOT_FOUND'; end if;
  if v_contrib.payer_user_id <> v_user then raise exception 'FORBIDDEN'; end if;
  if v_contrib.status = 'confirmed' then raise exception 'ALREADY_PAID'; end if;
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