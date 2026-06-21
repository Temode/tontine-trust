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
  recording_url?: string | null;
  recording_size?: number | null;
  recording_duration_seconds?: number | null;
  recording_consent_user_ids?: string[];
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

// ---------------- Participants (audio call) ----------------

export interface CallParticipant {
  call_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  is_muted: boolean;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
}

export async function listCallParticipants(callId: string): Promise<CallParticipant[]> {
  const { data, error } = await supabase
    .from("call_participants")
    .select("*, profile:profiles!call_participants_user_id_fkey(full_name, avatar_url)")
    .eq("call_id", callId);
  if (error) throw error;
  return (data ?? []) as CallParticipant[];
}

export async function joinCall(callId: string): Promise<void> {
  const { error } = await supabase.rpc("join_call", { p_call_id: callId });
  if (error) throw error;
}

export async function leaveCall(callId: string): Promise<void> {
  const { error } = await supabase.rpc("leave_call", { p_call_id: callId });
  if (error) throw error;
}

export async function setCallMute(callId: string, muted: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_call_mute", {
    p_call_id: callId,
    p_muted: muted,
  });
  if (error) throw error;
}

export function subscribeCallParticipants(
  callId: string,
  onChange: () => void,
): RealtimeChannel {
  return supabase
    .channel(`call_participants:${callId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "call_participants",
        filter: `call_id=eq.${callId}`,
      },
      () => onChange(),
    )
    .subscribe();
}

export async function getActiveCallForGroup(groupId: string): Promise<{ id: string; status: CallStatus } | null> {
  const { data, error } = await supabase
    .from("call_requests")
    .select("id, status")
    .eq("group_id", groupId)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string; status: CallStatus } | null) ?? null;
}

// ---------------- Recording ----------------

export async function giveCallRecordingConsent(callId: string): Promise<void> {
  const { error } = await supabase.rpc("give_call_recording_consent", { p_call_id: callId });
  if (error) throw error;
}

export async function setCallRecording(
  callId: string,
  url: string,
  size: number,
  durationSeconds: number,
): Promise<void> {
  const { error } = await supabase.rpc("set_call_recording", {
    p_call_id: callId,
    p_url: url,
    p_size: size,
    p_duration: durationSeconds,
  });
  if (error) throw error;
}

export async function uploadCallRecording(
  groupId: string,
  callId: string,
  blob: Blob,
): Promise<{ path: string; signedUrl: string }> {
  const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "mp4" : "webm";
  const path = `${groupId}/${callId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("call-recordings")
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await supabase.storage
    .from("call-recordings")
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
  if (error) throw error;
  return { path, signedUrl: data.signedUrl };
}

export async function getRecordingSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("call-recordings")
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

// ---------------- ICE servers (STUN + optional TURN) ----------------

export async function fetchIceServers(): Promise<{ iceServers: RTCIceServer[]; turn: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke("get-ice-servers");
    if (error || !data) throw error ?? new Error("no data");
    return data as { iceServers: RTCIceServer[]; turn: boolean };
  } catch (e) {
    console.warn("fetchIceServers fallback to STUN", e);
    return {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
      turn: false,
    };
  }
}