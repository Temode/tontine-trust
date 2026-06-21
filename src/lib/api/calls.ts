import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type CallStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "missed"
  | "ended";

export interface CallRequest {
  id: string;
  group_id: string;
  requested_by: string;
  topic: string | null;
  scheduled_at: string | null;
  status: CallStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  requester?: { full_name: string | null; avatar_url: string | null } | null;
}

export async function listCallRequests(groupId: string): Promise<CallRequest[]> {
  const { data, error } = await supabase
    .from("call_requests")
    .select(
      "*, requester:profiles!call_requests_requested_by_fkey(full_name, avatar_url)",
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as CallRequest[];
}

export async function requestGroupCall(
  groupId: string,
  topic: string,
  scheduledAt: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc("request_group_call", {
    p_group_id: groupId,
    p_topic: topic,
    p_scheduled_at: scheduledAt,
  });
  if (error) throw error;
  return data as string;
}

export async function respondCallRequest(
  id: string,
  status: Exclude<CallStatus, "pending">,
): Promise<void> {
  const { error } = await supabase.rpc("respond_call_request", {
    p_id: id,
    p_status: status,
  });
  if (error) throw error;
}

export function subscribeCallRequests(
  groupId: string,
  onChange: () => void,
): RealtimeChannel {
  return supabase
    .channel(`call_requests:${groupId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "call_requests", filter: `group_id=eq.${groupId}` },
      () => onChange(),
    )
    .subscribe();
}