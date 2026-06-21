import { supabase } from "@/integrations/supabase/client";

export type DisputeStatus = "open" | "under_review" | "accepted" | "rejected" | "resolved";

export interface ContributionDispute {
  id: string;
  contribution_id: string;
  group_id: string;
  raised_by: string;
  reason: string;
  evidence_url: string | null;
  status: DisputeStatus;
  organizer_response: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupDisputeRow {
  id: string;
  contribution_id: string;
  raised_by: string;
  raised_by_name: string | null;
  reason: string;
  evidence_url: string | null;
  status: DisputeStatus;
  organizer_response: string | null;
  amount: number;
  turn_number: number;
  due_date: string;
  created_at: string;
  resolved_at: string | null;
}

export interface UserDefaultHistoryRow {
  contribution_id: string;
  group_id: string;
  group_name: string;
  turn_number: number;
  due_date: string;
  amount: number;
  status: string;
  defaulted_at: string | null;
  default_days: number | null;
  paid_at: string | null;
  notifications_count: number;
  report_status: string | null;
  dispute_status: DisputeStatus | null;
  penalty_amount: number | null;
}

export async function raiseDispute(args: {
  contributionId: string;
  reason: string;
  evidenceUrl?: string | null;
}) {
  const { data, error } = await supabase.rpc("raise_contribution_dispute", {
    _contribution_id: args.contributionId,
    _reason: args.reason,
    _evidence_url: args.evidenceUrl ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function resolveDispute(args: {
  disputeId: string;
  status: Exclude<DisputeStatus, "open">;
  response?: string;
}) {
  const { error } = await supabase.rpc("resolve_contribution_dispute", {
    _dispute_id: args.disputeId,
    _status: args.status,
    _response: args.response ?? null,
  });
  if (error) throw error;
}

export async function listMyDisputes(): Promise<ContributionDispute[]> {
  const { data, error } = await supabase
    .from("contribution_disputes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContributionDispute[];
}

export async function listGroupDisputes(groupId: string): Promise<GroupDisputeRow[]> {
  const { data, error } = await supabase.rpc("list_group_disputes", { _group_id: groupId });
  if (error) throw error;
  return (data ?? []) as GroupDisputeRow[];
}

export async function getUserDefaultHistory(): Promise<UserDefaultHistoryRow[]> {
  const { data, error } = await supabase.rpc("get_user_default_history", { _user_id: undefined as unknown as string });
  if (error) throw error;
  return (data ?? []) as UserDefaultHistoryRow[];
}