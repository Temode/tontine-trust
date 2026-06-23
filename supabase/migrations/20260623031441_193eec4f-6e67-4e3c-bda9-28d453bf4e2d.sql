
-- ============================================================
-- Chantier 4 — Idempotence + admin pour la rétention payouts
-- ============================================================

-- 1) Table de déduplication des notifs "payout_hold_extended"
CREATE TABLE IF NOT EXISTS public.payout_hold_notifications_log (
  turn_id uuid PRIMARY KEY REFERENCES public.turns(id) ON DELETE CASCADE,
  beneficiary_user_id uuid NOT NULL,
  hold_until timestamptz NOT NULL,
  first_sent_at timestamptz NOT NULL DEFAULT now(),
  resend_count int NOT NULL DEFAULT 0,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  last_actor_user_id uuid
);

GRANT SELECT ON public.payout_hold_notifications_log TO authenticated;
GRANT ALL ON public.payout_hold_notifications_log TO service_role;

ALTER TABLE public.payout_hold_notifications_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Beneficiary or admin can read hold log" ON public.payout_hold_notifications_log;
CREATE POLICY "Beneficiary or admin can read hold log"
  ON public.payout_hold_notifications_log FOR SELECT TO authenticated
  USING (
    beneficiary_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE INDEX IF NOT EXISTS idx_payout_hold_notif_log_user
  ON public.payout_hold_notifications_log (beneficiary_user_id);

-- 2) Fonction idempotente : envoie la notif + SMS au plus une fois
CREATE OR REPLACE FUNCTION public.send_payout_hold_extended_if_needed(
  _turn_id uuid,
  _force boolean DEFAULT false,
  _actor uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_turn public.turns%ROWTYPE;
  v_log public.payout_hold_notifications_log%ROWTYPE;
  v_should_send boolean := false;
BEGIN
  SELECT * INTO v_turn FROM public.turns WHERE id = _turn_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_turn.payout_hold_until IS NULL THEN RETURN false; END IF;
  IF v_turn.payout_hold_until <= coalesce(v_turn.paid_at, now()) + interval '7 days' THEN
    -- Pas de majoration, rien à notifier
    RETURN false;
  END IF;

  SELECT * INTO v_log FROM public.payout_hold_notifications_log
    WHERE turn_id = _turn_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.payout_hold_notifications_log
      (turn_id, beneficiary_user_id, hold_until, last_actor_user_id)
    VALUES (_turn_id, v_turn.beneficiary_user_id, v_turn.payout_hold_until, _actor);
    v_should_send := true;
  ELSIF _force THEN
    UPDATE public.payout_hold_notifications_log
      SET resend_count = resend_count + 1,
          last_sent_at = now(),
          last_actor_user_id = _actor,
          hold_until = v_turn.payout_hold_until
      WHERE turn_id = _turn_id;
    v_should_send := true;
  ELSE
    -- Déjà envoyé et pas de force => no-op (idempotent)
    RETURN false;
  END IF;

  IF v_should_send THEN
    -- Notification in-app (déduplication via cette table → 1 seule entrée garantie)
    INSERT INTO public.notifications (user_id, kind, title, body, group_id, turn_id)
    VALUES (
      v_turn.beneficiary_user_id,
      'payout_hold_extended'::public.notification_kind,
      'Libération de votre payout repoussée',
      'Suite à un retard de cotisation, vos fonds seront disponibles le ' ||
        to_char(v_turn.payout_hold_until, 'DD/MM/YYYY') || '.',
      v_turn.group_id,
      v_turn.id
    );

    PERFORM public.enqueue_tontine_sms(
      'payout_hold_extended',
      jsonb_build_object(
        'turn_id',             v_turn.id,
        'group_id',            v_turn.group_id,
        'turn_number',         v_turn.turn_number,
        'beneficiary_user_id', v_turn.beneficiary_user_id,
        'amount',              v_turn.payout_amount,
        'hold_until',          v_turn.payout_hold_until,
        'resend',              coalesce(_force, false)
      )
    );
  END IF;

  RETURN v_should_send;
END $$;

GRANT EXECUTE ON FUNCTION public.send_payout_hold_extended_if_needed(uuid, boolean, uuid)
  TO authenticated, service_role;

-- 3) Trigger sur turns : passe par la fonction idempotente
CREATE OR REPLACE FUNCTION public.trg_sms_on_turn_paid()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v_cycle_done boolean;
begin
  if TG_OP = 'UPDATE' and NEW.status = 'paid'
     and OLD.status is distinct from 'paid' then

    perform public.enqueue_tontine_sms(
      'turn_paid',
      jsonb_build_object(
        'turn_id',              NEW.id,
        'group_id',             NEW.group_id,
        'turn_number',          NEW.turn_number,
        'beneficiary_user_id',  NEW.beneficiary_user_id,
        'amount',               NEW.payout_amount
      )
    );

    -- Notif majorée (idempotente)
    PERFORM public.send_payout_hold_extended_if_needed(NEW.id, false, NULL);

    select not exists (
      select 1 from public.turns
       where cycle_id = NEW.cycle_id
         and status <> 'paid'
    ) into v_cycle_done;

    if v_cycle_done then
      perform public.enqueue_tontine_sms(
        'cycle_completed',
        jsonb_build_object(
          'group_id', NEW.group_id,
          'cycle_id', NEW.cycle_id
        )
      );
    end if;
  end if;
  return NEW;
end $$;

-- 4) Admin RPC: liste les tours avec rétention + historique
CREATE OR REPLACE FUNCTION public.admin_list_payout_holds(_only_active boolean DEFAULT false)
RETURNS TABLE (
  turn_id uuid,
  group_id uuid,
  group_name text,
  turn_number int,
  beneficiary_user_id uuid,
  beneficiary_name text,
  payout_amount bigint,
  paid_at timestamptz,
  payout_hold_until timestamptz,
  is_extended boolean,
  is_released boolean,
  was_late_in_cycle boolean,
  was_late_at_turn_number int[],
  notif_first_sent_at timestamptz,
  notif_last_sent_at timestamptz,
  notif_resend_count int
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
    SELECT
      t.id,
      t.group_id,
      g.name,
      t.turn_number,
      t.beneficiary_user_id,
      p.full_name,
      t.payout_amount,
      t.paid_at,
      t.payout_hold_until,
      (t.payout_hold_until > coalesce(t.paid_at, now()) + interval '7 days') AS is_extended,
      (t.payout_hold_until IS NOT NULL AND t.payout_hold_until <= now())     AS is_released,
      coalesce(gm.was_late_in_cycle, false),
      gm.was_late_at_turn_number,
      ln.first_sent_at,
      ln.last_sent_at,
      coalesce(ln.resend_count, 0)
    FROM public.turns t
    JOIN public.groups g ON g.id = t.group_id
    LEFT JOIN public.profiles p ON p.id = t.beneficiary_user_id
    LEFT JOIN public.group_members gm
      ON gm.group_id = t.group_id AND gm.user_id = t.beneficiary_user_id
    LEFT JOIN public.payout_hold_notifications_log ln ON ln.turn_id = t.id
    WHERE t.payout_hold_until IS NOT NULL
      AND (NOT _only_active OR t.payout_hold_until > now())
    ORDER BY t.payout_hold_until DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_list_payout_holds(boolean) TO authenticated;

-- 5) Admin RPC: resend de la notification (force)
CREATE OR REPLACE FUNCTION public.admin_resend_payout_hold_notice(_turn_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_sent boolean;
BEGIN
  IF NOT public.has_role(v_user, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  v_sent := public.send_payout_hold_extended_if_needed(_turn_id, true, v_user);

  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (v_user, 'admin_resend_payout_hold_notice', 'turn', _turn_id,
          jsonb_build_object('sent', v_sent));

  RETURN v_sent;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_resend_payout_hold_notice(uuid) TO authenticated;

-- 6) RPC bénéficiaire: historique de mes rétentions (libérées ou non)
CREATE OR REPLACE FUNCTION public.list_my_payout_hold_history()
RETURNS TABLE (
  turn_id uuid,
  group_id uuid,
  group_name text,
  turn_number int,
  payout_amount bigint,
  paid_at timestamptz,
  payout_hold_until timestamptz,
  is_extended boolean,
  is_released boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    t.id,
    t.group_id,
    g.name,
    t.turn_number,
    t.payout_amount,
    t.paid_at,
    t.payout_hold_until,
    (t.payout_hold_until > coalesce(t.paid_at, now()) + interval '7 days') AS is_extended,
    (t.payout_hold_until IS NOT NULL AND t.payout_hold_until <= now())     AS is_released
  FROM public.turns t
  JOIN public.groups g ON g.id = t.group_id
  WHERE t.beneficiary_user_id = auth.uid()
    AND t.status = 'paid'
    AND t.payout_hold_until IS NOT NULL
  ORDER BY t.paid_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_payout_hold_history() TO authenticated;
