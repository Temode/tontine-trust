import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface DbGroupMessage {
  id: string;
  group_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  author?: { full_name: string | null; avatar_url: string | null } | null;
}

export async function listGroupMessages(groupId: string, limit = 100): Promise<DbGroupMessage[]> {
  const { data, error } = await supabase
    .from("group_messages")
    .select("*, author:profiles!group_messages_author_user_id_fkey(full_name, avatar_url)")
    .eq("group_id", groupId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DbGroupMessage[];
}

export async function sendGroupMessage(groupId: string, body: string): Promise<DbGroupMessage> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Non authentifié");
  const { data, error } = await supabase
    .from("group_messages")
    .insert({ group_id: groupId, author_user_id: uid, body: body.trim() })
    .select("*, author:profiles!group_messages_author_user_id_fkey(full_name, avatar_url)")
    .single();
  if (error) throw error;
  return data as DbGroupMessage;
}

export function subscribeGroupMessages(
  groupId: string,
  onInsert: (m: DbGroupMessage) => void,
): RealtimeChannel {
  return supabase
    .channel(`group_chat:${groupId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
      (payload) => onInsert(payload.new as DbGroupMessage),
    )
    .subscribe();
}