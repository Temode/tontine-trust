-- 1) Objectif d'épargne + cotisation optionnelle pour les Solo
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS target_amount bigint;
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_contribution_amount_check;
ALTER TABLE public.groups ADD CONSTRAINT groups_contribution_amount_check
  CHECK ((kind = 'solo'::public.group_kind AND contribution_amount >= 0)
      OR (kind <> 'solo'::public.group_kind AND contribution_amount > 0));
ALTER TABLE public.groups ADD CONSTRAINT groups_target_amount_check
  CHECK (target_amount IS NULL OR target_amount > 0);

-- 2) Table des dépôts d'épargne Solo
CREATE TABLE IF NOT EXISTS public.solo_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed','cancelled')),
  provider text,
  payment_method text,
  djomy_transaction_id text,
  note text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_solo_deposits_group ON public.solo_deposits(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_solo_deposits_user ON public.solo_deposits(user_id);

GRANT SELECT, INSERT, UPDATE ON public.solo_deposits TO authenticated;
GRANT ALL ON public.solo_deposits TO service_role;

ALTER TABLE public.solo_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solo_deposits_select_own" ON public.solo_deposits
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "solo_deposits_insert_own" ON public.solo_deposits
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "solo_deposits_update_own_pending" ON public.solo_deposits
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status IN ('pending','cancelled'));

CREATE OR REPLACE FUNCTION public.solo_deposits_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_solo_deposits_touch ON public.solo_deposits;
CREATE TRIGGER trg_solo_deposits_touch BEFORE UPDATE ON public.solo_deposits
  FOR EACH ROW EXECUTE FUNCTION public.solo_deposits_touch();

-- 3) Création Solo : cotisation/fréquence optionnelles + objectif
CREATE OR REPLACE FUNCTION public.create_solo_group(
  _name text,
  _description text DEFAULT '',
  _category text DEFAULT '',
  _mode public.solo_mode DEFAULT 'working_capital',
  _contribution bigint DEFAULT 0,
  _frequency public.group_frequency DEFAULT 'mensuelle',
  _lock_until timestamptz DEFAULT NULL,
  _target_amount bigint DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _ent jsonb; _max_solo int; _used_solo int; _group_id uuid; _plan text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF coalesce(_name,'') = '' THEN RAISE EXCEPTION 'NAME_REQUIRED'; END IF;
  IF _mode IS NULL THEN RAISE EXCEPTION 'INVALID_SOLO_MODE'; END IF;
  IF _target_amount IS NOT NULL AND _target_amount <= 0 THEN RAISE EXCEPTION 'INVALID_TARGET_AMOUNT'; END IF;
  IF _mode = 'project'::public.solo_mode THEN
    IF _lock_until IS NULL OR _lock_until <= now() THEN
      RAISE EXCEPTION 'INVALID_SOLO_LOCK_UNTIL';
    END IF;
  END IF;

  SELECT public.get_my_entitlements() INTO _ent;
  _max_solo := coalesce((_ent->'limits'->>'max_solo')::int, 0);
  _plan := coalesce(_ent->>'plan_code', 'free');
  SELECT count(*) INTO _used_solo
    FROM public.groups
   WHERE created_by = _uid
     AND kind = 'solo'::public.group_kind
     AND archived_at IS NULL
     AND deleted_at IS NULL;
  IF _max_solo <> -1 AND _used_solo >= _max_solo THEN
    RAISE EXCEPTION 'QUOTA_SOLO_EXCEEDED:%/%:%', _used_solo, _max_solo, _plan;
  END IF;

  INSERT INTO public.groups (
    name, description, category, contribution_amount, frequency, max_members,
    rotation_order_kind, late_penalty_percent, late_penalty_after_days,
    status, visibility, co_organizers, created_by,
    new_member_lock_last_third, deposit_required, deposit_months,
    kind, solo_mode, solo_lock_until, target_amount
  ) VALUES (
    _name, nullif(_description,''), nullif(_category,''),
    GREATEST(coalesce(_contribution, 0), 0),
    coalesce(_frequency,'mensuelle'::public.group_frequency), 1,
    'fixed'::public.rotation_order, 0, 0,
    'active'::public.group_status, 'private'::public.group_visibility, '{}'::text[], _uid,
    false, false, 0,
    'solo'::public.group_kind, _mode, _lock_until, _target_amount
  ) RETURNING id INTO _group_id;

  INSERT INTO public.group_members (group_id, user_id, role, status, joined_at)
  VALUES (_group_id, _uid, 'organisateur'::public.member_role, 'active'::public.member_status, now())
  ON CONFLICT (group_id, user_id) DO UPDATE
    SET role = 'organisateur'::public.member_role,
        status = 'active'::public.member_status,
        joined_at = COALESCE(public.group_members.joined_at, now());

  BEGIN
    PERFORM public.dispatch_notification(
      _uid,
      'system'::public.notification_kind,
      'Tontine Solo créée',
      format('Votre épargne Solo « %s » est active. Déposez le montant que vous voulez, quand vous voulez.', _name),
      jsonb_build_object('group_id', _group_id, 'kind', 'solo', 'solo_mode', _mode::text),
      _group_id,
      '/solo/' || _group_id::text
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    PERFORM public.enqueue_generic_sms(
      'solo_created',
      ARRAY[_uid],
      format('Tontine Digitale : votre epargne Solo "%s" a ete creee. Deposez librement quand vous voulez.', _name),
      _group_id
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('group_id', _group_id);
END
$function$;

-- 4) Lecture d'une Solo
CREATE OR REPLACE FUNCTION public.get_my_solo_group(_group_id uuid)
RETURNS TABLE(
  id uuid, name text, description text, category text,
  solo_mode public.solo_mode, solo_lock_until timestamptz,
  target_amount bigint, created_at timestamptz, status text,
  total_saved bigint, pending_amount bigint, deposits_count int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT g.id, g.name, g.description, g.category,
         g.solo_mode, g.solo_lock_until, g.target_amount, g.created_at, g.status::text,
         coalesce((SELECT sum(d.amount) FROM public.solo_deposits d
                    WHERE d.group_id = g.id AND d.status = 'confirmed'), 0)::bigint,
         coalesce((SELECT sum(d.amount) FROM public.solo_deposits d
                    WHERE d.group_id = g.id AND d.status = 'pending'), 0)::bigint,
         coalesce((SELECT count(*) FROM public.solo_deposits d
                    WHERE d.group_id = g.id AND d.status = 'confirmed'), 0)::int
    FROM public.groups g
   WHERE g.id = _group_id
     AND g.kind = 'solo'::public.group_kind
     AND g.created_by = auth.uid();
$function$;

-- 5) Liste des Solo : totaux réels + objectif saisi
CREATE OR REPLACE FUNCTION public.list_my_solo_groups()
RETURNS TABLE(
  id uuid, name text, description text, category text,
  contribution_amount bigint, frequency public.group_frequency,
  solo_mode public.solo_mode, solo_lock_until timestamptz,
  created_at timestamptz, status text, total_saved bigint, target_amount bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT g.id, g.name, g.description, g.category,
         g.contribution_amount, g.frequency, g.solo_mode, g.solo_lock_until,
         g.created_at, g.status::text,
         coalesce((SELECT sum(d.amount) FROM public.solo_deposits d
                    WHERE d.group_id = g.id AND d.status = 'confirmed'), 0)::bigint,
         g.target_amount
    FROM public.groups g
   WHERE g.created_by = auth.uid()
     AND g.kind = 'solo'::public.group_kind
     AND g.deleted_at IS NULL
   ORDER BY g.created_at DESC;
$function$;

-- 6) Réglages d'une Solo
CREATE OR REPLACE FUNCTION public.update_my_solo_group(
  _group_id uuid, _name text DEFAULT NULL, _description text DEFAULT NULL,
  _target_amount bigint DEFAULT NULL, _clear_target boolean DEFAULT false,
  _lock_until timestamptz DEFAULT NULL, _clear_lock boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_g record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_g FROM public.groups
   WHERE id = _group_id AND kind = 'solo'::public.group_kind AND created_by = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOLO_NOT_FOUND'; END IF;
  IF _target_amount IS NOT NULL AND _target_amount <= 0 THEN RAISE EXCEPTION 'INVALID_TARGET_AMOUNT'; END IF;
  IF _lock_until IS NOT NULL AND _lock_until <= now() THEN RAISE EXCEPTION 'INVALID_SOLO_LOCK_UNTIL'; END IF;
  IF _clear_lock AND v_g.solo_lock_until IS NOT NULL AND v_g.solo_lock_until > now() THEN
    RAISE EXCEPTION 'SOLO_LOCKED_UNTIL:%', to_char(v_g.solo_lock_until, 'YYYY-MM-DD"T"HH24:MI:SSOF');
  END IF;

  UPDATE public.groups SET
    name = COALESCE(nullif(trim(_name), ''), name),
    description = COALESCE(_description, description),
    target_amount = CASE WHEN _clear_target THEN NULL
                         WHEN _target_amount IS NOT NULL THEN _target_amount
                         ELSE target_amount END,
    solo_lock_until = CASE WHEN _clear_lock THEN NULL
                           WHEN _lock_until IS NOT NULL THEN _lock_until
                           ELSE solo_lock_until END,
    updated_at = now()
  WHERE id = _group_id;
END $function$;

-- 7) Démarrer un dépôt libre
CREATE OR REPLACE FUNCTION public.start_solo_deposit(_group_id uuid, _amount bigint)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_g record; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  SELECT * INTO v_g FROM public.groups
   WHERE id = _group_id AND kind = 'solo'::public.group_kind AND created_by = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOLO_NOT_FOUND'; END IF;
  IF v_g.archived_at IS NOT NULL OR v_g.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'SOLO_ARCHIVED'; END IF;

  INSERT INTO public.solo_deposits (group_id, user_id, amount, status, provider)
  VALUES (_group_id, v_uid, _amount, 'pending', 'djomy')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('deposit_id', v_id, 'amount', _amount);
END $function$;

-- 8) Historique des dépôts
CREATE OR REPLACE FUNCTION public.list_solo_deposits(_group_id uuid, _limit int DEFAULT 50)
RETURNS TABLE(
  id uuid, amount bigint, status text, payment_method text,
  djomy_transaction_id text, confirmed_at timestamptz, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT d.id, d.amount, d.status, d.payment_method, d.djomy_transaction_id,
         d.confirmed_at, d.created_at
    FROM public.solo_deposits d
    JOIN public.groups g ON g.id = d.group_id
   WHERE d.group_id = _group_id
     AND g.created_by = auth.uid()
     AND d.user_id = auth.uid()
   ORDER BY d.created_at DESC
   LIMIT GREATEST(coalesce(_limit, 50), 1);
$function$;

-- 9) Retour de paiement : confirme le dépôt et crédite le solde consolidé
CREATE OR REPLACE FUNCTION public.apply_solo_deposit_webhook(
  _deposit_id uuid, _new_status text,
  _provider_ref text DEFAULT NULL, _payment_method text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_d record; v_mapped text;
BEGIN
  SELECT * INTO v_d FROM public.solo_deposits WHERE id = _deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOLO_DEPOSIT_NOT_FOUND'; END IF;
  IF v_d.status = 'confirmed' THEN RETURN; END IF;

  v_mapped := CASE WHEN _new_status IN ('paid','succeeded','confirmed') THEN 'confirmed'
                   WHEN _new_status = 'failed' THEN 'failed'
                   WHEN _new_status = 'cancelled' THEN 'cancelled'
                   ELSE 'pending' END;

  UPDATE public.solo_deposits
     SET status = v_mapped,
         confirmed_at = CASE WHEN v_mapped = 'confirmed' THEN now() ELSE confirmed_at END,
         djomy_transaction_id = COALESCE(_provider_ref, djomy_transaction_id),
         payment_method = COALESCE(_payment_method, payment_method)
   WHERE id = _deposit_id;

  IF v_mapped <> 'confirmed' THEN RETURN; END IF;

  INSERT INTO public.beneficiary_balances (user_id, group_id, available_amount, total_credited)
  VALUES (v_d.user_id, v_d.group_id, v_d.amount, v_d.amount)
  ON CONFLICT (user_id, group_id) DO UPDATE
    SET available_amount = public.beneficiary_balances.available_amount + EXCLUDED.available_amount,
        total_credited = public.beneficiary_balances.total_credited + EXCLUDED.total_credited,
        updated_at = now();

  PERFORM public.record_platform_entry(
    'client_escrow', 'contribution', 'in', v_d.amount,
    'solo_deposit:' || v_d.id::text,
    v_d.user_id, v_d.group_id, NULL, NULL, NULL, NULL,
    'Dépôt épargne Solo'
  );

  BEGIN
    PERFORM public.dispatch_notification(
      v_d.user_id,
      'system'::public.notification_kind,
      'Dépôt confirmé',
      format('Votre dépôt de %s GNF a été ajouté à votre épargne Solo.', to_char(v_d.amount, 'FM999G999G999')),
      jsonb_build_object('group_id', v_d.group_id, 'deposit_id', v_d.id, 'kind', 'solo_deposit'),
      v_d.group_id,
      '/solo/' || v_d.group_id::text
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $function$;