-- Trigger: si une cotisation est confirmée après son échéance, marquer le payeur en retard
CREATE OR REPLACE FUNCTION public.mark_late_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_due date;
  v_turn_no int;
  v_confirmed_at timestamptz;
BEGIN
  IF NEW.status <> 'confirmed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' THEN RETURN NEW; END IF;

  SELECT due_date, turn_number INTO v_due, v_turn_no
  FROM public.turns WHERE id = NEW.turn_id;

  v_confirmed_at := COALESCE(NEW.confirmed_at, now());

  IF v_due IS NOT NULL AND v_confirmed_at::date > v_due THEN
    UPDATE public.group_members
      SET was_late_in_cycle = true,
          was_late_at_turn_number = (
            SELECT ARRAY(SELECT DISTINCT unnest(
              COALESCE(was_late_at_turn_number, ARRAY[]::int[]) || ARRAY[v_turn_no]
            ))
          )
      WHERE user_id = NEW.payer_user_id
        AND group_id = NEW.group_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_late_on_confirm ON public.contributions;
CREATE TRIGGER trg_mark_late_on_confirm
AFTER INSERT OR UPDATE OF status, confirmed_at ON public.contributions
FOR EACH ROW EXECUTE FUNCTION public.mark_late_on_confirm();