
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS new_member_lock_last_third boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_months smallint NOT NULL DEFAULT 0;

ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_deposit_months_range;
ALTER TABLE public.groups
  ADD CONSTRAINT groups_deposit_months_range
  CHECK (deposit_months >= 0 AND deposit_months <= 2);

ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_deposit_required_consistent;
ALTER TABLE public.groups
  ADD CONSTRAINT groups_deposit_required_consistent
  CHECK (deposit_required = false OR deposit_months >= 1);

ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS joined_after_start boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_status text NOT NULL DEFAULT 'not_required';

ALTER TABLE public.group_members DROP CONSTRAINT IF EXISTS group_members_deposit_status_check;
ALTER TABLE public.group_members
  ADD CONSTRAINT group_members_deposit_status_check
  CHECK (deposit_status IN ('not_required','pending','paid','refunded','forfeited'));

CREATE TABLE IF NOT EXISTS public.member_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  months smallint NOT NULL CHECK (months BETWEEN 1 AND 2),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','cancelled','refunded','forfeited')),
  djomy_transaction_id text,
  redirect_url text,
  payer_phone text,
  payment_method text,
  paid_at timestamptz,
  refunded_at timestamptz,
  refund_reason text,
  forfeited_at timestamptz,
  forfeit_reason text,
  initiated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_deposits_group_user_idx ON public.member_deposits(group_id, user_id);
CREATE INDEX IF NOT EXISTS member_deposits_status_idx ON public.member_deposits(status);

GRANT SELECT, INSERT, UPDATE ON public.member_deposits TO authenticated;
GRANT ALL ON public.member_deposits TO service_role;

ALTER TABLE public.member_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_deposits_select_self ON public.member_deposits;
CREATE POLICY member_deposits_select_self ON public.member_deposits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_group_organizer(group_id, auth.uid()));

DROP POLICY IF EXISTS member_deposits_no_direct_write ON public.member_deposits;
CREATE POLICY member_deposits_no_direct_write ON public.member_deposits
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.member_deposits_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_member_deposits_touch ON public.member_deposits;
CREATE TRIGGER trg_member_deposits_touch
  BEFORE UPDATE ON public.member_deposits
  FOR EACH ROW EXECUTE FUNCTION public.member_deposits_touch();

CREATE OR REPLACE FUNCTION public.group_is_started(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = _group_id
      AND g.status IN ('active','paused','completed')
  )
$$;

CREATE OR REPLACE FUNCTION public.start_member_deposit(
  _group_id uuid,
  _payer_phone text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_group record;
  v_member record;
  v_amount bigint;
  v_existing record;
  v_deposit_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT id, contribution_amount, deposit_required, deposit_months
    INTO v_group FROM public.groups WHERE id = _group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'GROUP_NOT_FOUND'; END IF;
  IF NOT v_group.deposit_required OR v_group.deposit_months < 1 THEN
    RAISE EXCEPTION 'DEPOSIT_NOT_REQUIRED';
  END IF;

  SELECT * INTO v_member FROM public.group_members
    WHERE group_id = _group_id AND user_id = v_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_A_MEMBER'; END IF;
  IF v_member.deposit_status = 'paid' THEN
    RAISE EXCEPTION 'DEPOSIT_ALREADY_PAID';
  END IF;

  v_amount := v_group.contribution_amount * v_group.deposit_months;

  SELECT * INTO v_existing FROM public.member_deposits
    WHERE group_id = _group_id AND user_id = v_user AND status = 'pending'
    ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    v_deposit_id := v_existing.id;
    UPDATE public.member_deposits
      SET payer_phone = COALESCE(_payer_phone, payer_phone)
      WHERE id = v_deposit_id;
  ELSE
    INSERT INTO public.member_deposits (
      group_id, user_id, amount, months, status, payer_phone, initiated_by
    ) VALUES (
      _group_id, v_user, v_amount, v_group.deposit_months,
      'pending', _payer_phone, v_user
    ) RETURNING id INTO v_deposit_id;
  END IF;

  UPDATE public.group_members
    SET deposit_status = 'pending'
    WHERE group_id = _group_id AND user_id = v_user
      AND deposit_status NOT IN ('paid','refunded');

  RETURN jsonb_build_object(
    'deposit_id', v_deposit_id,
    'amount', v_amount,
    'months', v_group.deposit_months
  );
END $$;

CREATE OR REPLACE FUNCTION public.attach_deposit_djomy_reference(
  _deposit_id uuid, _transaction_id text, _redirect_url text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.member_deposits
    SET djomy_transaction_id = _transaction_id, redirect_url = _redirect_url
    WHERE id = _deposit_id;
END $$;

CREATE OR REPLACE FUNCTION public.apply_deposit_webhook(
  _deposit_id uuid, _new_status text,
  _provider_ref text DEFAULT NULL, _payment_method text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dep record;
BEGIN
  SELECT * INTO v_dep FROM public.member_deposits WHERE id = _deposit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEPOSIT_NOT_FOUND'; END IF;
  IF v_dep.status IN ('paid','refunded','forfeited') THEN RETURN; END IF;
  IF _new_status NOT IN ('paid','succeeded','failed','cancelled','pending') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;
  UPDATE public.member_deposits
    SET status = CASE WHEN _new_status IN ('paid','succeeded') THEN 'paid'
                      WHEN _new_status = 'failed' THEN 'failed'
                      WHEN _new_status = 'cancelled' THEN 'cancelled'
                      ELSE 'pending' END,
        paid_at = CASE WHEN _new_status IN ('paid','succeeded') THEN now() ELSE paid_at END,
        djomy_transaction_id = COALESCE(_provider_ref, djomy_transaction_id),
        payment_method = COALESCE(_payment_method, payment_method)
    WHERE id = _deposit_id;
  IF _new_status IN ('paid','succeeded') THEN
    UPDATE public.group_members SET deposit_status = 'paid'
      WHERE group_id = v_dep.group_id AND user_id = v_dep.user_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_refund_member_deposit(
  _deposit_id uuid, _reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_dep record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_dep FROM public.member_deposits WHERE id = _deposit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEPOSIT_NOT_FOUND'; END IF;
  IF NOT public.is_group_organizer(v_dep.group_id, v_user)
     AND NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF v_dep.status <> 'paid' THEN RAISE EXCEPTION 'DEPOSIT_NOT_PAID'; END IF;
  UPDATE public.member_deposits
    SET status='refunded', refunded_at=now(), refund_reason=_reason
    WHERE id=_deposit_id;
  UPDATE public.group_members SET deposit_status='refunded'
    WHERE group_id=v_dep.group_id AND user_id=v_dep.user_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_forfeit_member_deposit(
  _deposit_id uuid, _reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_dep record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 10 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  SELECT * INTO v_dep FROM public.member_deposits WHERE id = _deposit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEPOSIT_NOT_FOUND'; END IF;
  IF NOT public.is_group_organizer(v_dep.group_id, v_user)
     AND NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF v_dep.status <> 'paid' THEN RAISE EXCEPTION 'DEPOSIT_NOT_PAID'; END IF;
  UPDATE public.member_deposits
    SET status='forfeited', forfeited_at=now(), forfeit_reason=_reason
    WHERE id=_deposit_id;
  UPDATE public.group_members SET deposit_status='forfeited'
    WHERE group_id=v_dep.group_id AND user_id=v_dep.user_id;
END $$;

CREATE OR REPLACE FUNCTION public.join_group_with_code(
  _code text, _operator text DEFAULT NULL::text,
  _message text DEFAULT NULL::text,
  _accepted_terms_version text DEFAULT NULL::text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invitation public.invitations%rowtype;
  v_visibility public.group_visibility;
  v_user uuid := auth.uid();
  v_count int; v_max int; v_attempt_count int;
  v_target_status public.member_status;
  v_target_position int;
  v_ip_hash text;
  v_kyc_level smallint; v_cap bigint; v_amount bigint;
  v_started boolean;
  v_deposit_required boolean;
  v_lock_last_third boolean;
  v_initial_deposit_status text := 'not_required';
  v_last_third_start int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _accepted_terms_version IS NULL OR _accepted_terms_version = '' THEN
    RAISE EXCEPTION 'TERMS_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_terms_versions WHERE version = _accepted_terms_version) THEN
    RAISE EXCEPTION 'TERMS_VERSION_UNKNOWN';
  END IF;

  SELECT COUNT(*) INTO v_attempt_count FROM public.join_attempts
    WHERE user_id = v_user AND attempted_at > now() - interval '10 minutes';
  IF v_attempt_count >= 10 THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
  INSERT INTO public.join_attempts (user_id) VALUES (v_user);

  IF _operator IS NOT NULL AND _operator NOT IN ('orange','mtn') THEN RAISE EXCEPTION 'INVALID_OPERATOR'; END IF;
  IF _message IS NOT NULL AND char_length(_message) > 280 THEN RAISE EXCEPTION 'MESSAGE_TOO_LONG'; END IF;

  SELECT * INTO v_invitation FROM public.invitations WHERE code = _code;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_NOT_FOUND'; END IF;
  IF v_invitation.status <> 'pending' THEN RAISE EXCEPTION 'INVITATION_INACTIVE'; END IF;
  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < now() THEN
    UPDATE public.invitations SET status='expired' WHERE id=v_invitation.id;
    RAISE EXCEPTION 'INVITATION_EXPIRED';
  END IF;
  IF v_invitation.max_uses IS NOT NULL AND v_invitation.uses_count >= v_invitation.max_uses THEN
    RAISE EXCEPTION 'INVITATION_EXHAUSTED';
  END IF;

  SELECT kyc_level INTO v_kyc_level FROM public.profiles WHERE id = v_user;
  v_kyc_level := COALESCE(v_kyc_level, 0);
  SELECT contribution_amount, max_members, visibility, deposit_required, new_member_lock_last_third
    INTO v_amount, v_max, v_visibility, v_deposit_required, v_lock_last_third
    FROM public.groups WHERE id = v_invitation.group_id;
  SELECT max_contribution_amount INTO v_cap FROM public.kyc_levels_config WHERE level = v_kyc_level;
  IF v_amount > COALESCE(v_cap, 0) THEN RAISE EXCEPTION 'KYC_INSUFFICIENT'; END IF;

  SELECT COUNT(*) INTO v_count FROM public.group_members
    WHERE group_id = v_invitation.group_id AND status='active';
  IF v_count >= v_max THEN RAISE EXCEPTION 'GROUP_FULL'; END IF;

  v_started := public.group_is_started(v_invitation.group_id);

  IF v_visibility = 'private' THEN
    v_target_status := 'active';
    v_target_position := v_count + 1;
  ELSE
    v_target_status := 'pending';
    v_target_position := NULL;
  END IF;

  IF v_started AND v_lock_last_third AND v_target_position IS NOT NULL THEN
    v_last_third_start := CEIL(v_max * 2.0 / 3.0)::int + 1;
    IF v_target_position < v_last_third_start THEN
      v_target_position := v_last_third_start;
    END IF;
  END IF;

  IF v_started AND v_deposit_required THEN
    v_initial_deposit_status := 'pending';
  END IF;

  INSERT INTO public.group_members (
    group_id, user_id, role, status, position,
    preferred_operator, applicant_message,
    joined_after_start, deposit_status
  ) VALUES (
    v_invitation.group_id, v_user, 'membre', v_target_status, v_target_position,
    _operator, _message, v_started, v_initial_deposit_status
  )
  ON CONFLICT (group_id, user_id) DO UPDATE SET
    status = CASE WHEN public.group_members.status IN ('active','pending')
                  THEN public.group_members.status ELSE excluded.status END,
    preferred_operator = COALESCE(excluded.preferred_operator, public.group_members.preferred_operator),
    applicant_message = COALESCE(excluded.applicant_message, public.group_members.applicant_message);

  UPDATE public.invitations SET uses_count = uses_count + 1 WHERE id = v_invitation.id;

  BEGIN
    v_ip_hash := encode(
      digest(COALESCE(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), 'sha256'),
      'hex'
    );
  EXCEPTION WHEN OTHERS THEN v_ip_hash := NULL; END;

  INSERT INTO public.group_consent_log (user_id, group_id, terms_version, ip_hash)
  VALUES (v_user, v_invitation.group_id, _accepted_terms_version, v_ip_hash);

  INSERT INTO public.notifications (user_id, kind, title, body, group_id)
  VALUES (
    v_invitation.created_by, 'invitation_accepted',
    CASE WHEN v_target_status = 'pending' THEN 'Nouvelle candidature' ELSE 'Nouveau membre' END,
    CASE WHEN v_target_status = 'pending'
      THEN 'Une personne candidate à votre groupe via invitation.'
      ELSE 'Un membre a rejoint votre groupe via invitation.' END,
    v_invitation.group_id
  );

  RETURN v_invitation.group_id;
END $$;

CREATE OR REPLACE FUNCTION public.create_group_with_invitation(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid(); v_group_id uuid; v_code text;
  v_requested_code text := nullif(_payload->>'invite_code', '');
  v_visibility public.group_visibility := coalesce((_payload->>'visibility')::public.group_visibility, 'private');
  v_rotation public.rotation_order := coalesce((_payload->>'rotation_order_kind')::public.rotation_order, 'random');
  v_frequency public.group_frequency := coalesce((_payload->>'frequency')::public.group_frequency, 'mensuelle');
  v_lock_last_third boolean := coalesce((_payload->>'new_member_lock_last_third')::boolean, false);
  v_deposit_required boolean := coalesce((_payload->>'deposit_required')::boolean, false);
  v_deposit_months smallint := coalesce((_payload->>'deposit_months')::smallint, 0);
  v_attempts int := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF coalesce(_payload->>'name','') = '' THEN RAISE EXCEPTION 'NAME_REQUIRED'; END IF;
  IF coalesce((_payload->>'contribution_amount')::bigint, 0) <= 0 THEN RAISE EXCEPTION 'INVALID_CONTRIBUTION'; END IF;
  IF coalesce((_payload->>'max_members')::int, 0) < 2 THEN RAISE EXCEPTION 'INVALID_MAX_MEMBERS'; END IF;
  IF v_deposit_required AND v_deposit_months < 1 THEN v_deposit_months := 1; END IF;
  IF v_deposit_months > 2 THEN v_deposit_months := 2; END IF;

  INSERT INTO public.groups (
    name, description, category, contribution_amount, frequency, max_members,
    rotation_order_kind, late_penalty_percent, late_penalty_after_days,
    status, visibility, co_organizers, created_by,
    new_member_lock_last_third, deposit_required, deposit_months
  ) VALUES (
    _payload->>'name', nullif(_payload->>'description',''), nullif(_payload->>'category',''),
    (_payload->>'contribution_amount')::bigint, v_frequency, (_payload->>'max_members')::int, v_rotation,
    coalesce((_payload->>'late_penalty_percent')::int, 0),
    coalesce((_payload->>'late_penalty_after_days')::int, 0),
    'open', v_visibility,
    coalesce(array(select jsonb_array_elements_text(coalesce(_payload->'co_organizers','[]'::jsonb))), '{}'),
    v_user, v_lock_last_third, v_deposit_required, v_deposit_months
  ) RETURNING id INTO v_group_id;

  v_code := v_requested_code;
  LOOP
    v_attempts := v_attempts + 1;
    IF v_code IS NULL THEN v_code := public._generate_invite_code(); END IF;
    BEGIN
      INSERT INTO public.invitations (group_id, code, created_by) VALUES (v_group_id, v_code, v_user);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts >= 5 THEN RAISE EXCEPTION 'INVITATION_CODE_COLLISION'; END IF;
      v_code := NULL;
    END;
  END LOOP;
  RETURN jsonb_build_object('group_id', v_group_id, 'invite_code', v_code);
END $$;

CREATE OR REPLACE FUNCTION public.update_group_settings(_group_id uuid, _payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid(); v_window text; v_old record;
  v_active_members int; v_new_freq public.group_frequency;
  v_new_late int; v_new_max int;
  v_structural_changed boolean := false; v_sensitive_changed boolean := false;
  v_diff jsonb := '{}'::jsonb; r_member record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_group_organizer(_group_id, v_user) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_old FROM public.groups WHERE id = _group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'GROUP_NOT_FOUND'; END IF;
  v_window := public.group_edit_window(_group_id);
  IF v_window = 'locked' THEN RAISE EXCEPTION 'GROUP_LOCKED'; END IF;

  IF _payload ? 'name' AND coalesce(_payload->>'name','') = '' THEN RAISE EXCEPTION 'NAME_REQUIRED'; END IF;
  IF _payload ? 'contribution_amount'
     AND coalesce((_payload->>'contribution_amount')::bigint,0) < 1000 THEN RAISE EXCEPTION 'INVALID_CONTRIBUTION'; END IF;
  IF _payload ? 'max_members' THEN
    v_new_max := (_payload->>'max_members')::int;
    IF v_new_max < 2 OR v_new_max > 50 THEN RAISE EXCEPTION 'INVALID_MAX_MEMBERS'; END IF;
    SELECT count(*) INTO v_active_members FROM public.group_members
      WHERE group_id=_group_id AND status='active';
    IF v_new_max < v_active_members THEN RAISE EXCEPTION 'MAX_MEMBERS_TOO_LOW'; END IF;
  END IF;
  v_new_freq := coalesce((_payload->>'frequency')::public.group_frequency, v_old.frequency);
  v_new_late := coalesce((_payload->>'late_penalty_after_days')::int, v_old.late_penalty_after_days);
  IF v_new_freq = 'quotidienne'::public.group_frequency AND v_new_late > 1 THEN
    RAISE EXCEPTION 'INVALID_FREQUENCY_LATE_DAYS';
  END IF;

  IF (_payload ? 'contribution_amount' AND (_payload->>'contribution_amount')::bigint IS DISTINCT FROM v_old.contribution_amount)
     OR (_payload ? 'frequency' AND (_payload->>'frequency')::public.group_frequency IS DISTINCT FROM v_old.frequency)
     OR (_payload ? 'max_members' AND (_payload->>'max_members')::int IS DISTINCT FROM v_old.max_members)
     OR (_payload ? 'rotation_order_kind' AND (_payload->>'rotation_order_kind')::public.rotation_order IS DISTINCT FROM v_old.rotation_order_kind)
     OR (_payload ? 'late_penalty_percent' AND (_payload->>'late_penalty_percent')::int IS DISTINCT FROM v_old.late_penalty_percent)
     OR (_payload ? 'late_penalty_after_days' AND (_payload->>'late_penalty_after_days')::int IS DISTINCT FROM v_old.late_penalty_after_days)
  THEN v_structural_changed := true; END IF;

  IF (_payload ? 'contribution_amount' AND (_payload->>'contribution_amount')::bigint IS DISTINCT FROM v_old.contribution_amount)
     OR (_payload ? 'frequency' AND (_payload->>'frequency')::public.group_frequency IS DISTINCT FROM v_old.frequency)
     OR (_payload ? 'rotation_order_kind' AND (_payload->>'rotation_order_kind')::public.rotation_order IS DISTINCT FROM v_old.rotation_order_kind)
  THEN v_sensitive_changed := true; END IF;

  IF v_window = 'in_cycle' AND v_structural_changed THEN RAISE EXCEPTION 'STRUCTURAL_CHANGE_FORBIDDEN'; END IF;

  v_diff := jsonb_build_object('window', v_window, 'before', to_jsonb(v_old), 'patch', _payload);

  IF v_window = 'in_cycle' THEN
    UPDATE public.groups SET
      name = coalesce(nullif(_payload->>'name',''), name),
      description = CASE WHEN _payload ? 'description' THEN nullif(_payload->>'description','') ELSE description END,
      category = CASE WHEN _payload ? 'category' THEN nullif(_payload->>'category','') ELSE category END,
      visibility = coalesce((_payload->>'visibility')::public.group_visibility, visibility),
      new_member_lock_last_third = coalesce((_payload->>'new_member_lock_last_third')::boolean, new_member_lock_last_third),
      deposit_required = coalesce((_payload->>'deposit_required')::boolean, deposit_required),
      deposit_months = coalesce((_payload->>'deposit_months')::smallint, deposit_months),
      updated_at = now()
    WHERE id = _group_id;
  ELSE
    UPDATE public.groups SET
      name = coalesce(nullif(_payload->>'name',''), name),
      description = CASE WHEN _payload ? 'description' THEN nullif(_payload->>'description','') ELSE description END,
      category = CASE WHEN _payload ? 'category' THEN nullif(_payload->>'category','') ELSE category END,
      contribution_amount = coalesce((_payload->>'contribution_amount')::bigint, contribution_amount),
      frequency = coalesce((_payload->>'frequency')::public.group_frequency, frequency),
      max_members = coalesce((_payload->>'max_members')::int, max_members),
      rotation_order_kind = coalesce((_payload->>'rotation_order_kind')::public.rotation_order, rotation_order_kind),
      late_penalty_percent = coalesce((_payload->>'late_penalty_percent')::int, late_penalty_percent),
      late_penalty_after_days = coalesce((_payload->>'late_penalty_after_days')::int, late_penalty_after_days),
      visibility = coalesce((_payload->>'visibility')::public.group_visibility, visibility),
      new_member_lock_last_third = coalesce((_payload->>'new_member_lock_last_third')::boolean, new_member_lock_last_third),
      deposit_required = coalesce((_payload->>'deposit_required')::boolean, deposit_required),
      deposit_months = coalesce((_payload->>'deposit_months')::smallint, deposit_months),
      updated_at = now()
    WHERE id = _group_id;
  END IF;

  PERFORM public.log_audit(_group_id, 'update_group_settings', 'group', _group_id, v_diff);

  IF v_sensitive_changed AND v_window = 'between_cycles' THEN
    INSERT INTO public.group_consent_log (group_id, user_id, consent_kind, payload)
    VALUES (_group_id, v_user, 'settings_change', v_diff);
  END IF;

  IF v_structural_changed AND v_window IN ('between_cycles','pre_cycle') THEN
    FOR r_member IN
      SELECT user_id FROM public.group_members
       WHERE group_id=_group_id AND status='active' AND user_id<>v_user
    LOOP
      INSERT INTO public.notifications (user_id, kind, title, body, group_id)
      VALUES (
        r_member.user_id, 'system',
        'Paramètres du groupe mis à jour',
        'L''organisateur a modifié la configuration du groupe « ' || v_old.name || ' ». Consultez les nouveaux paramètres avant le prochain cycle.',
        _group_id
      );
    END LOOP;
  END IF;
END $$;
