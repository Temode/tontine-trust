CREATE OR REPLACE FUNCTION public.start_cycle(_group_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_group public.groups%ROWTYPE;
  v_count int;
  v_cycle_id uuid;
  v_cycle_number int;
  v_freq_days int;
  v_payout bigint;
  v_due date;
  r RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = _group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'GROUP_NOT_FOUND'; END IF;
  IF NOT public.is_group_organizer(_group_id, v_user) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF v_group.status NOT IN ('draft','open') THEN
    RAISE EXCEPTION 'CYCLE_ALREADY_STARTED';
  END IF;

  SELECT count(*) INTO v_count FROM public.group_members
    WHERE group_id = _group_id AND status = 'active';
  IF v_count < 2 THEN RAISE EXCEPTION 'QUORUM_NOT_REACHED'; END IF;

  IF v_group.rotation_order_kind = 'random' THEN
    WITH shuffled AS (
      SELECT id, row_number() OVER (ORDER BY random()) AS rn
      FROM public.group_members
      WHERE group_id = _group_id AND status = 'active'
    )
    UPDATE public.group_members gm SET position = s.rn
    FROM shuffled s WHERE gm.id = s.id;
  ELSE
    WITH ordered AS (
      SELECT id, row_number() OVER (
        ORDER BY position NULLS LAST, joined_at
      ) AS rn
      FROM public.group_members
      WHERE group_id = _group_id AND status = 'active'
    )
    UPDATE public.group_members gm SET position = o.rn
    FROM ordered o WHERE gm.id = o.id;
  END IF;

  SELECT coalesce(max(cycle_number), 0) + 1 INTO v_cycle_number
    FROM public.cycles WHERE group_id = _group_id;

  INSERT INTO public.cycles (group_id, cycle_number, started_at)
  VALUES (_group_id, v_cycle_number, now())
  RETURNING id INTO v_cycle_id;

  v_freq_days := public.frequency_to_days(v_group.frequency);
  IF v_freq_days IS NULL THEN v_freq_days := 7; END IF;

  v_payout := v_group.contribution_amount * v_count;
  v_due := current_date + v_freq_days;

  FOR r IN
    SELECT user_id, position
    FROM public.group_members
    WHERE group_id = _group_id AND status = 'active'
    ORDER BY position
  LOOP
    INSERT INTO public.turns (
      cycle_id, group_id, beneficiary_user_id,
      turn_number, due_date, payout_amount, status
    ) VALUES (
      v_cycle_id, _group_id, r.user_id,
      r.position, v_due, v_payout,
      (CASE WHEN r.position = 1 THEN 'collecting' ELSE 'upcoming' END)::public.turn_status
    );

    IF r.position = 1 THEN
      INSERT INTO public.contributions (
        turn_id, group_id, payer_user_id, amount, status
      )
      SELECT
        (SELECT id FROM public.turns
           WHERE cycle_id = v_cycle_id AND turn_number = 1),
        _group_id, gm.user_id, v_group.contribution_amount,
        'pending'::public.contribution_status
      FROM public.group_members gm
      WHERE gm.group_id = _group_id
        AND gm.status = 'active'
        AND gm.user_id <> r.user_id;
    END IF;

    v_due := v_due + v_freq_days;
  END LOOP;

  -- Authorize the internal group status transition (the trigger
  -- trg_groups_block_direct_status only allows updates through whitelisted RPCs).
  PERFORM set_config('app.via_rpc', '1', TRUE);
  UPDATE public.groups SET status = 'active' WHERE id = _group_id;

  INSERT INTO public.notifications (user_id, kind, title, body, group_id)
  SELECT gm.user_id, 'cycle_started'::public.notification_kind,
    'Cycle démarré',
    'L''ordre de rotation a été tiré. Premier tour ouvert à la collecte.',
    _group_id
  FROM public.group_members gm
  WHERE gm.group_id = _group_id AND gm.status = 'active';

  RETURN v_cycle_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.start_cycle(uuid) TO authenticated;