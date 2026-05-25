import { supabase } from "@/integrations/supabase/client";
import type { GroupDraft } from "@/components/create-group/types";
import { FREQ_TO_DB, type DbGroup, type DbGroupOverview } from "./types";

export async function listMyGroups(): Promise<DbGroupOverview[]> {
  const { data, error } = await supabase
    .from("my_groups_overview")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbGroupOverview[];
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
    created_by: uid,
  };

  const { data, error } = await supabase.from("groups").insert(payload).select("*").single();
  if (error) throw error;
  return { group: data as DbGroup };
}