import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type PresenceStatus = "available" | "busy" | "dnd";

export interface UserPresence {
  user_id: string;
  status: PresenceStatus;
  updated_at: string;
}

export async function getMyPresence(): Promise<PresenceStatus> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return "available";
  const { data, error } = await supabase
    .from("user_call_presence")
    .select("status")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw error;
  return (data?.status as PresenceStatus | undefined) ?? "available";
}

export async function setMyPresence(status: PresenceStatus): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Non authentifié");
  const { error } = await supabase
    .from("user_call_presence")
    .upsert(
      { user_id: uid, status, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

export async function getGroupPresence(groupId: string): Promise<UserPresence[]> {
  // Fetch presence of every active member in the group
  const { data: members, error: mErr } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("status", "active");
  if (mErr) throw mErr;
  const ids = (members ?? []).map((m) => m.user_id as string);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("user_call_presence")
    .select("*")
    .in("user_id", ids);
  if (error) throw error;
  return (data ?? []) as UserPresence[];
}

export function subscribePresence(
  groupId: string,
  onChange: () => void,
): RealtimeChannel {
  // We can't easily filter, so listen broadly and refetch
  return supabase
    .channel(`presence:${groupId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_call_presence" },
      () => onChange(),
    )
    .subscribe();
}