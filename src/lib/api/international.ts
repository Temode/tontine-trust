import { supabase } from "@/integrations/supabase/client";

export interface InternationalGroup {
  group_id: string;
  name: string;
  description: string | null;
  category: string | null;
  contribution_amount: number;
  frequency: string;
  max_members: number;
  current_members: number;
  seats_left: number;
  status: string;
  avg_reliability: number;
  created_at: string;
}

export interface AnonMember {
  anon_label: string;
  role: string;
  reliability_score: number;
  joined_at: string | null;
}

export interface RenewalVote {
  user_id: string;
  agreed: boolean;
  voted_at: string;
  full_name: string | null;
}

export async function listInternationalGroups(): Promise<InternationalGroup[]> {
  const { data, error } = await supabase.rpc("list_international_groups");
  if (error) throw error;
  return (data ?? []) as unknown as InternationalGroup[];
}

export async function getInternationalGroupMembers(groupId: string): Promise<AnonMember[]> {
  const { data, error } = await supabase.rpc("get_international_group_members", { _group_id: groupId });
  if (error) throw error;
  return (data ?? []) as unknown as AnonMember[];
}

export async function applyToInternationalGroup(groupId: string, message?: string): Promise<string> {
  const { data, error } = await supabase.rpc("apply_to_international_group", {
    _group_id: groupId,
    _message: message ?? null,
  });
  if (error) throw new Error(translateApplyError(error.message));
  return data as unknown as string;
}

export async function voteCycleRenewal(cycleId: string, agreed: boolean): Promise<void> {
  const { error } = await supabase.rpc("vote_cycle_renewal", { _cycle_id: cycleId, _agreed: agreed });
  if (error) throw error;
}

export async function markCycleAwaitingRenewal(cycleId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_cycle_awaiting_renewal", { _cycle_id: cycleId });
  if (error) throw error;
}

export async function listRenewalVotes(cycleId: string): Promise<RenewalVote[]> {
  const { data, error } = await supabase.rpc("list_renewal_votes", { _cycle_id: cycleId });
  if (error) throw error;
  return (data ?? []) as unknown as RenewalVote[];
}

function translateApplyError(msg: string): string {
  if (msg.includes("already_applied_or_member")) return "Vous avez déjà postulé ou êtes déjà membre.";
  if (msg.includes("group_full")) return "Ce groupe est complet.";
  if (msg.includes("group_not_open")) return "Ce groupe n'accepte plus de candidatures.";
  if (msg.includes("group_not_found_or_not_international")) return "Groupe introuvable.";
  if (msg.includes("not_authenticated")) return "Vous devez être connecté.";
  return msg;
}
