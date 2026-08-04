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

    -- SMS si rétention majorée (Chantier 4)
    IF NEW.payout_hold_until IS NOT NULL
       AND NEW.payout_hold_until > coalesce(NEW.paid_at, now()) + interval '7 days' THEN
      perform public.enqueue_tontine_sms(
        'payout_hold_extended',
        jsonb_build_object(
          'turn_id',             NEW.id,
          'group_id',            NEW.group_id,
          'turn_number',         NEW.turn_number,
          'beneficiary_user_id', NEW.beneficiary_user_id,
          'amount',              NEW.payout_amount,
          'hold_until',          NEW.payout_hold_until
        )
      );
    END IF;

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