
-- 1) Colonne flag
ALTER TABLE public.turns
  ADD COLUMN IF NOT EXISTS payout_released_at timestamptz NULL;

-- 2) Backfill : on marque les anciens tours déjà sortis de rétention pour éviter un flood SMS
UPDATE public.turns
SET payout_released_at = COALESCE(payout_hold_until, paid_at, now())
WHERE status = 'paid'
  AND payout_released_at IS NULL
  AND (payout_hold_until IS NULL OR payout_hold_until <= now());

-- 3) Fonction de libération automatique
CREATE OR REPLACE FUNCTION public.release_due_payout_holds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row       record;
  v_count     integer := 0;
  v_token     text;
  v_url       text;
  v_gname     text;
  v_body      text;
  v_ref       text;
BEGIN
  -- Token interne pour appeler la function send-tontine-sms
  SELECT value INTO v_token FROM public.internal_config WHERE key = 'tontine_sms_token';
  SELECT value INTO v_url   FROM public.internal_config WHERE key = 'tontine_sms_url';

  FOR v_row IN
    SELECT t.id, t.group_id, t.turn_number, t.payout_amount,
           t.beneficiary_user_id, t.payout_hold_until,
           g.name AS group_name
    FROM public.turns t
    JOIN public.groups g ON g.id = t.group_id
    WHERE t.status = 'paid'
      AND t.payout_hold_until IS NOT NULL
      AND t.payout_hold_until <= now()
      AND t.payout_released_at IS NULL
      AND t.beneficiary_user_id IS NOT NULL
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.turns
       SET payout_released_at = now()
     WHERE id = v_row.id;

    -- Notification in-app
    INSERT INTO public.notifications (user_id, kind, title, body, group_id, turn_id, link, data)
    VALUES (
      v_row.beneficiary_user_id,
      'payout_hold_released',
      'Fonds disponibles',
      format('La période de retenue sur votre tour #%s de la tontine "%s" est terminée. Vos fonds (%s GNF) sont à nouveau disponibles.',
             v_row.turn_number, v_row.group_name, to_char(v_row.payout_amount, 'FM999G999G999')),
      v_row.group_id,
      v_row.id,
      '/balance',
      jsonb_build_object('amount', v_row.payout_amount, 'turn_number', v_row.turn_number)
    );

    -- SMS via send-tontine-sms (generic_broadcast)
    IF v_token IS NOT NULL AND v_url IS NOT NULL THEN
      v_ref := 'TD' || to_char(now() AT TIME ZONE 'UTC', 'YYMMDD.HH24MI') || upper(substr(md5(random()::text || v_row.id::text), 1, 6));
      v_body := format(
        'Bonjour, la periode de retenue sur votre tour #%s de la tontine "%s" est terminee. Vos fonds (%s GNF) sont a nouveau disponibles. Demandez votre retrait depuis l''application. Ref: %s. Tontine Digitale vous informe.',
        v_row.turn_number,
        v_row.group_name,
        to_char(v_row.payout_amount, 'FM999G999G999'),
        v_ref
      );

      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Internal-Token', v_token
        ),
        body := jsonb_build_object(
          'kind', 'generic_broadcast',
          'sms_kind', 'payout_hold_released',
          'group_id', v_row.group_id,
          'turn_id', v_row.id,
          'recipients', jsonb_build_array(v_row.beneficiary_user_id),
          'body', v_body
        )
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.release_due_payout_holds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_due_payout_holds() TO service_role;
