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

export interface CreateGroupResult {
  group: DbGroup;
}

export async function createGroup(draft: GroupDraft): Promise<CreateGroupResult> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("AUTH_REQUIRED");

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
    status: "open" as const,
    visibility: draft.visibility,
    co_organizers: coOrganizers,
    created_by: uid,
  };

  const { data, error } = await supabase.from("groups").insert(payload).select("*").single();
  if (error) throw error;
  return { group: data as DbGroup };
}