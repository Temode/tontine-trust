import { supabase } from "@/integrations/supabase/client";

export type PausePaymentRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "consumed"
  | "expired";

export interface PausePaymentRequest {
  id: string;
  group_id: string;
  contribution_id: string;
  requested_by: string;
  status: PausePaymentRequestStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  requester_name?: string | null;
}

/** Creates (or reuses) a payment authorization request while the group is paused. */
export async function requestPaymentDuringPause(contributionId: string): Promise<string> {
  const { data, error } = await supabase.rpc("request_payment_during_pause", {
    _contribution_id: contributionId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Organizer-side decision: approve or reject a pending request. */
export async function decidePaymentPauseRequest(
  requestId: string,
  approve: boolean,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc("decide_payment_pause_request", {
    _request_id: requestId,
    _approve: approve,
    _reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
}

/** All requests visible to the current user for a given group (own + organizer view). */
export async function listGroupPauseRequests(groupId: string): Promise<PausePaymentRequest[]> {
  const { data, error } = await supabase
    .from("payment_pause_requests")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as PausePaymentRequest[];

  const ids = Array.from(new Set(rows.map((r) => r.requested_by)));
  if (ids.length === 0) return rows;
  const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  const byId = new Map((profs ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]));
  return rows.map((r) => ({ ...r, requester_name: byId.get(r.requested_by) ?? null }));
}