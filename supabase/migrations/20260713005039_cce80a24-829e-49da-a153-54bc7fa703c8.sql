
-- Redeploy join_group_with_code with a `link` on the invitation_accepted notification
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
  v_amount bigint;
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

  -- KYC volontairement désactivé.
  SELECT contribution_amount, max_members, visibility, deposit_required, new_member_lock_last_third
    INTO v_amount, v_max, v_visibility, v_deposit_required, v_lock_last_third
    FROM public.groups WHERE id = v_invitation.group_id;

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

  INSERT INTO public.notifications (user_id, kind, title, body, group_id, link)
  VALUES (
    v_invitation.created_by, 'invitation_accepted',
    CASE WHEN v_target_status = 'pending' THEN 'Nouvelle candidature' ELSE 'Nouveau membre' END,
    CASE WHEN v_target_status = 'pending'
      THEN 'Une personne candidate à votre groupe via invitation.'
      ELSE 'Un membre a rejoint votre groupe via invitation.' END,
    v_invitation.group_id,
    '/groupes/' || v_invitation.group_id::text || '/membres'
  );

  RETURN v_invitation.group_id;
END $$;

-- Backfill : anciennes notifications sans lien
UPDATE public.notifications
   SET link = '/groupes/' || group_id::text || '/membres'
 WHERE link IS NULL
   AND group_id IS NOT NULL
   AND kind IN ('invitation_accepted', 'member_joined');

UPDATE public.notifications
   SET link = '/groupes/' || group_id::text
 WHERE link IS NULL
   AND group_id IS NOT NULL
   AND kind IN ('cycle_started','turn_started','turn_paid','announcement','group_completed');
