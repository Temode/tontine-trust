CREATE OR REPLACE FUNCTION public.enforce_solo_single_member_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_kind public.group_kind;
  v_count int;
BEGIN
  SELECT kind INTO v_kind FROM public.groups WHERE id = NEW.group_id;
  IF v_kind IS DISTINCT FROM 'solo'::public.group_kind THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
    FROM public.group_members
   WHERE group_id = NEW.group_id
     AND user_id <> NEW.user_id
     AND status IN ('active'::public.member_status, 'pending'::public.member_status, 'invited'::public.member_status);

  IF v_count > 0 THEN
    RAISE EXCEPTION 'SOLO_SINGLE_MEMBER_ONLY';
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_solo_single_member_row ON public.group_members;
CREATE TRIGGER trg_solo_single_member_row
  BEFORE INSERT OR UPDATE OF user_id, status ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_solo_single_member_row();