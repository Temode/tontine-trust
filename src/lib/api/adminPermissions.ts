import { supabase } from "@/integrations/supabase/client";

export interface AdminPermissionsRow {
  group_id: string;
  user_id: string;
  can_approve_members: boolean;
  can_suspend_member: boolean;
  can_kick_member: boolean;
  can_edit_settings: boolean;
  can_manage_invitations: boolean;
  can_confirm_payments: boolean;
  can_waive_penalty: boolean;
  can_send_announcements: boolean;
  can_pause_cycle: boolean;
  granted_at: string;
  full_name?: string | null;
  phone_number?: string | null;
}

export const ADMIN_PERMISSION_KEYS = [
  "can_approve_members",
  "can_suspend_member",
  "can_kick_member",
  "can_edit_settings",
  "can_manage_invitations",
  "can_confirm_payments",
  "can_waive_penalty",
  "can_send_announcements",
  "can_pause_cycle",
] as const;

export type AdminPermissionKey = (typeof ADMIN_PERMISSION_KEYS)[number];

export const ADMIN_PERMISSION_LABELS: Record<AdminPermissionKey, string> = {
  can_approve_members: "Approuver les candidatures",
  can_suspend_member: "Suspendre / réactiver un membre",
  can_kick_member: "Exclure définitivement un membre",
  can_edit_settings: "Modifier les paramètres du groupe",
  can_manage_invitations: "Gérer les invitations",
  can_confirm_payments: "Confirmer les paiements",
  can_waive_penalty: "Annuler une pénalité",
  can_send_announcements: "Publier des annonces",
  can_pause_cycle: "Mettre le cycle en pause",
};

export async function listAdminPermissions(groupId: string): Promise<AdminPermissionsRow[]> {
  const { data, error } = await supabase
    .from("group_admin_permissions_view")
    .select("*")
    .eq("group_id", groupId);
  if (error) throw error;
  return (data ?? []) as AdminPermissionsRow[];
}

export async function grantAdminPermissions(
  groupId: string,
  userId: string,
  perms: Partial<Record<AdminPermissionKey, boolean>>,
): Promise<void> {
  const { error } = await supabase.rpc("grant_admin_permissions", {
    _group_id: groupId,
    _user_id: userId,
    _perms: perms,
  });
  if (error) throw error;
}

export async function revokeAdminPermissions(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_admin_permissions", {
    _group_id: groupId,
    _user_id: userId,
  });
  if (error) throw error;
}