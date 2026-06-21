import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { listMyGroups } from "./groups";
import type { DbGroupOverview } from "./types";

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

export interface ChatConversation {
  group: DbGroupOverview;
  lastMessage: DbGroupMessage | null;
  unreadCount: number;
}

const LAST_SEEN_PREFIX = "chat-last-seen:";

export function getLastSeen(groupId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_SEEN_PREFIX + groupId);
}

export function markConversationSeen(groupId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_SEEN_PREFIX + groupId, new Date().toISOString());
}

export async function listConversationsForUser(): Promise<ChatConversation[]> {
  const groups = await listMyGroups();
  const active = groups.filter((g) => g.my_status === "active" || g.is_organizer);
  if (active.length === 0) return [];
  const ids = active.map((g) => g.id);
  const { data: msgs, error } = await supabase
    .from("group_messages")
    .select("*, author:profiles!group_messages_author_user_id_fkey(full_name, avatar_url)")
    .in("group_id", ids)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  const lastByGroup = new Map<string, DbGroupMessage>();
  const countsByGroup = new Map<string, number>();
  for (const m of (msgs ?? []) as DbGroupMessage[]) {
    if (!lastByGroup.has(m.group_id)) lastByGroup.set(m.group_id, m);
    const seen = getLastSeen(m.group_id);
    if (!seen || new Date(m.created_at) > new Date(seen)) {
      countsByGroup.set(m.group_id, (countsByGroup.get(m.group_id) ?? 0) + 1);
    }
  }
  const conversations: ChatConversation[] = active.map((g) => ({
    group: g,
    lastMessage: lastByGroup.get(g.id) ?? null,
    unreadCount: countsByGroup.get(g.id) ?? 0,
  }));
  conversations.sort((a, b) => {
    const at = a.lastMessage?.created_at ?? a.group.created_at;
    const bt = b.lastMessage?.created_at ?? b.group.created_at;
    return new Date(bt).getTime() - new Date(at).getTime();
  });
  return conversations;
}

export function subscribeAllUserConversations(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("user_conversations")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "group_messages" },
      () => onChange(),
    )
    .subscribe();
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