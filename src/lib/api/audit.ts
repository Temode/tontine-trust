import { supabase } from "@/integrations/supabase/client";

export interface DbAuditEntry {
  id: string;
  group_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_user_id: string | null;
  actor_name: string | null;
}

export async function listGroupAudit(groupId: string, limit = 100): Promise<DbAuditEntry[]> {
  const { data, error } = await supabase
    .from("audit_log_view")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DbAuditEntry[];
}

export const ACTION_LABEL: Record<string, string> = {
  start_cycle: "Cycle démarré",
  release_payout: "Versement effectué",
  update_group_settings: "Paramètres modifiés",
  approve_member: "Membre accepté",
  reject_member: "Candidature refusée",
  record_payment: "Paiement enregistré",
  invitation_created: "Invitation créée",
  invitation_revoked: "Invitation révoquée",
  member_suspended: "Membre suspendu",
  member_reactivated: "Membre réactivé",
  member_kicked: "Membre exclu",
  member_permissions_changed: "Permissions membre modifiées",
  permissions_changed: "Permissions co-organisateur modifiées",
  permissions_revoked: "Co-organisateur révoqué",
  ownership_transferred: "Propriété transférée",
  external_payment_submitted: "Preuve de paiement soumise",
  external_payment_confirmed: "Paiement externe confirmé",
  external_payment_rejected: "Paiement externe refusé",
  penalty_waived: "Pénalité annulée",
  penalty_adjusted: "Pénalité ajustée",
  cycle_paused: "Cycle mis en pause",
  cycle_resumed: "Cycle relancé",
  due_date_shifted: "Échéance reportée",
  group_archived: "Groupe archivé",
  manual_reminder_sent: "Rappel manuel envoyé",
  account_deleted: "Compte supprimé",
  phone_visibility_changed: "Visibilité téléphone modifiée",
  terms_accepted: "CGU acceptées",
};