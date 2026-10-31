CREATE TABLE public.group_assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.group_assistant_messages (group_id, user_id, created_at);
GRANT SELECT, DELETE ON public.group_assistant_messages TO authenticated;
GRANT ALL ON public.group_assistant_messages TO service_role;
ALTER TABLE public.group_assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own assistant messages read" ON public.group_assistant_messages
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own assistant messages delete" ON public.group_assistant_messages
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.assistant_context(p_group_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM group_members WHERE group_id = p_group_id AND user_id = v_uid AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'NOT_MEMBER' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'today', current_date,
    'groupe', (SELECT jsonb_build_object('nom', g.name, 'statut', g.status, 'montant_cotisation_gnf', g.contribution_amount,
        'frequence', g.frequency, 'membres_max', g.max_members, 'ordre_rotation', g.rotation_order_kind,
        'penalite_retard_pourcent', g.late_penalty_percent, 'penalite_apres_jours', g.late_penalty_after_days,
        'echange_tours', g.swap_policy, 'caution_requise', g.deposit_required, 'caution_mois', g.deposit_months,
        'en_pause_depuis', g.paused_at, 'international', g.is_international,
        'commission_coordinateur_pourcent', g.coordinator_commission_percent)
      FROM groups g WHERE g.id = p_group_id),
    'nb_membres_actifs', (SELECT count(*) FROM group_members WHERE group_id = p_group_id AND status = 'active'),
    'ma_position', (SELECT position FROM group_members WHERE group_id = p_group_id AND user_id = v_uid AND status='active' LIMIT 1),
    'mon_role', (SELECT role FROM group_members WHERE group_id = p_group_id AND user_id = v_uid AND status='active' LIMIT 1),
    'cycle', (SELECT jsonb_build_object('numero', c.cycle_number, 'debut', c.started_at, 'fin', c.ended_at)
      FROM cycles c WHERE c.group_id = p_group_id ORDER BY c.cycle_number DESC LIMIT 1),
    'calendrier_tours', (SELECT coalesce(jsonb_agg(jsonb_build_object('tour', t.turn_number, 'echeance', t.due_date,
        'beneficiaire', coalesce(p.full_name, 'Membre'), 'c_est_moi', t.beneficiary_user_id = v_uid,
        'montant_verse_gnf', t.payout_amount, 'statut', t.status) ORDER BY t.turn_number), '[]'::jsonb)
      FROM turns t LEFT JOIN profiles p ON p.id = t.beneficiary_user_id
      WHERE t.cycle_id = (SELECT id FROM cycles WHERE group_id = p_group_id ORDER BY cycle_number DESC LIMIT 1)),
    'mes_cotisations', (SELECT coalesce(jsonb_agg(jsonb_build_object('tour', t.turn_number, 'echeance', t.due_date,
        'montant_gnf', k.amount, 'statut', k.status, 'payee_le', coalesce(k.confirmed_at, k.submitted_at),
        'penalite_gnf', k.penalty_amount, 'penalite_annulee', k.penalty_waived_at IS NOT NULL,
        'jours_retard_defaut', k.default_days) ORDER BY t.turn_number), '[]'::jsonb)
      FROM contributions k JOIN turns t ON t.id = k.turn_id
      WHERE k.group_id = p_group_id AND k.payer_user_id = v_uid),
    'mon_solde_groupe_gnf', (SELECT jsonb_build_object('disponible', available_amount, 'total_recu', total_credited, 'total_retire', total_withdrawn)
      FROM beneficiary_balances WHERE group_id = p_group_id AND user_id = v_uid),
    'ma_fiabilite', (SELECT jsonb_build_object('score', score, 'niveau', tier, 'a_temps', total_on_time, 'en_retard', total_late)
      FROM user_reliability_scores WHERE user_id = v_uid)
  ) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.assistant_context(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.assistant_context(uuid) TO authenticated, service_role;