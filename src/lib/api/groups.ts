import { supabase } from "@/integrations/supabase/client";
import type { GroupDraft } from "@/components/create-group/types";
import { FREQ_TO_DB, type DbGroup, type DbGroupOverview } from "./types";
import type { JoinApplication } from "@/lib/types";

export async function listMyGroups(): Promise<DbGroupOverview[]> {
  const { data, error } = await supabase
    .from("my_groups_overview")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbGroupOverview[];
}

/** Retourne les groupes où l'utilisateur courant a une candidature en attente. */
export async function listMyApplications(): Promise<JoinApplication[]> {
  const rows = await listMyGroups();
  return rows
    .filter((r) => r.my_status === "pending" && !r.is_organizer)
    .map(overviewToApplication);
}

function overviewToApplication(row: DbGroupOverview): JoinApplication {
  const organizerName = row.organizer_name ?? "Organisateur";
  const initials = organizerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "OR";
  return {
    id: row.id,
    groupId: row.id,
    groupName: row.name,
    organizerName,
    organizerInitials: initials,
    contribution: row.contribution_amount,
    members: row.members_count,
    appliedOn: new Date(row.created_at).toLocaleDateString("fr-FR"),
    daysFromToday: 0,
    status: "pending",
  };
}

/** Retire une candidature en attente (le membre annule sa demande). */
export async function cancelMyApplication(groupId: string): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("AUTH_REQUIRED");
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", uid)
    .eq("status", "pending");
  if (error) throw error;
}

export async function getGroup(id: string): Promise<DbGroup> {
  const { data, error } = await supabase.from("groups").select("*").eq("id", id).single();
  if (error) throw error;
  return data as DbGroup;
}

export interface UpdateGroupSettingsPayload {
  name?: string;
  description?: string | null;
  category?: string | null;
  contribution_amount?: number;
  frequency?: "quotidienne" | "hebdomadaire" | "quinzaine" | "mensuelle";
  max_members?: number;
  rotation_order_kind?: "random" | "fixed" | "choice" | "auction";
  late_penalty_percent?: number;
  late_penalty_after_days?: number;
  visibility?: "private" | "public-link" | "directory";
  new_member_lock_last_third?: boolean;
  deposit_required?: boolean;
  deposit_months?: 0 | 1 | 2;
}

const UPDATE_ERROR_LABELS: Record<string, string> = {
  AUTH_REQUIRED: "Vous devez être connecté.",
  FORBIDDEN: "Seul l'organisateur peut modifier ce groupe.",
  GROUP_NOT_FOUND: "Groupe introuvable.",
  CYCLE_ALREADY_STARTED:
    "Le cycle est déjà démarré : les paramètres ne peuvent plus être modifiés.",
  NAME_REQUIRED: "Le nom du groupe est requis.",
  INVALID_CONTRIBUTION: "La cotisation doit être supérieure à zéro.",
  INVALID_MAX_MEMBERS: "Le nombre de membres est invalide.",
  STRUCTURAL_CHANGE_FORBIDDEN:
    "Un cycle est en cours : seuls le nom, la description et la visibilité peuvent être modifiés. Attendez la fin du cycle pour ajuster les règles.",
  MAX_MEMBERS_TOO_LOW:
    "Le nombre maximum doit être au moins égal au nombre de membres actifs.",
  GROUP_LOCKED:
    "Ce groupe est clôturé : la configuration ne peut plus être modifiée.",
  INVALID_FREQUENCY_LATE_DAYS:
    "Pour une fréquence quotidienne, le délai de pénalité ne peut pas dépasser 1 jour.",
};

export async function updateGroupSettings(
  groupId: string,
  payload: UpdateGroupSettingsPayload,
): Promise<void> {
  const { error } = await supabase.rpc("update_group_settings", {
    _group_id: groupId,
    _payload: payload as never,
  });
  if (error) {
    const key = Object.keys(UPDATE_ERROR_LABELS).find((k) =>
      error.message.includes(k),
    );
    throw new Error(key ? UPDATE_ERROR_LABELS[key] : error.message);
  }
}

export type GroupEditWindow =
  | "pre_cycle"
  | "between_cycles"
  | "in_cycle"
  | "locked";

export async function getGroupEditWindow(
  groupId: string,
): Promise<GroupEditWindow> {
  const { data, error } = await supabase.rpc("group_edit_window", {
    _group_id: groupId,
  });
  if (error) throw error;
  return (data as GroupEditWindow) ?? "locked";
}

export interface CreateGroupResult {
  group: DbGroup;
  inviteCode: string;
}

export async function createGroup(draft: GroupDraft): Promise<CreateGroupResult> {
  // Création transactionnelle via RPC : group + organisateur + invitation initiale.
  // Cf. db/13_phase_i_finalisation.sql.
  const rotation =
    draft.rotationOrder === "auction" ? "choice" : draft.rotationOrder; // DB n'a pas 'auction'

  const coOrganizers = draft.coOrganizerPhones
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const payload = {
    name: draft.name,
    description: draft.description || null,
    category: draft.category,
    contribution_amount: draft.contribution,
    frequency: FREQ_TO_DB[draft.frequency],
    max_members: draft.members,
    rotation_order_kind: rotation,
    late_penalty_percent: draft.latePenaltyPercent,
    late_penalty_after_days: draft.latePenaltyAfterDays,
    visibility: draft.visibility,
    co_organizers: coOrganizers,
    invite_code: draft.inviteCode,
    new_member_lock_last_third: draft.newMemberLockLastThird,
    deposit_required: draft.depositRequired,
    deposit_months: draft.depositMonths,
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "create_group_with_invitation",
    { _payload: payload },
  );
  if (rpcError) throw new Error(translateCreateGroupError(rpcError.message));
  const result = rpcData as { group_id: string; invite_code: string } | null;
  if (!result?.group_id) throw new Error("Réponse serveur invalide.");

  const { data: group, error: getErr } = await supabase
    .from("groups")
    .select("*")
    .eq("id", result.group_id)
    .single();
  if (getErr) throw getErr;
  return { group: group as DbGroup, inviteCode: result.invite_code };
}

const CREATE_ERROR_LABELS: Record<string, string> = {
  AUTH_REQUIRED: "Vous devez être connecté.",
  NAME_REQUIRED: "Le nom du groupe est requis.",
  INVALID_CONTRIBUTION: "La cotisation doit être supérieure à zéro.",
  INVALID_MAX_MEMBERS: "Le nombre de membres est invalide.",
  INVITATION_CODE_COLLISION: "Impossible de générer un code unique. Réessayez.",
};

function translateCreateGroupError(message: string): string {
  const key = Object.keys(CREATE_ERROR_LABELS).find((k) => message.includes(k));
  return key ? CREATE_ERROR_LABELS[key] : message;
}