import { supabase } from "@/integrations/supabase/client";

export type SwapStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface DbSwapRequest {
  id: string;
  group_id: string;
  status: SwapStatus;
  reason: string | null;
  created_at: string;
  responded_at: string | null;
  from_user_id: string;
  to_user_id: string;
  from_turn_id: string;
  to_turn_id: string;
  from_turn_number: number;
  to_turn_number: number;
  from_due_date: string;
  to_due_date: string;
  from_user_name: string | null;
  to_user_name: string | null;
}

export async function listGroupSwapRequests(groupId: string): Promise<DbSwapRequest[]> {
  const { data, error } = await supabase
    .from("turn_swap_requests_view")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbSwapRequest[];
}

export async function requestTurnSwap(args: {
  fromTurnId: string;
  toTurnId: string;
  reason?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("request_turn_swap", {
    _from_turn: args.fromTurnId,
    _to_turn: args.toTurnId,
    _reason: args.reason ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function respondTurnSwap(requestId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc("respond_turn_swap", {
    _request_id: requestId,
    _accept: accept,
  });
  if (error) throw error;
}

export async function cancelTurnSwap(requestId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_turn_swap", { _request_id: requestId });
  if (error) throw error;
}