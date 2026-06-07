import { supabase } from "@/integrations/supabase/client";

export interface DbAnnouncement {
  id: string;
  group_id: string;
  author_user_id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  author?: { full_name: string | null; avatar_url: string | null } | null;
}

export async function listAnnouncements(groupId: string): Promise<DbAnnouncement[]> {
  const { data, error } = await supabase
    .from("group_announcements")
    .select("*, author:profiles!group_announcements_author_user_id_fkey(full_name, avatar_url)")
    .eq("group_id", groupId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbAnnouncement[];
}

export async function createAnnouncement(
  groupId: string,
  title: string,
  body: string,
  pinned = false,
): Promise<DbAnnouncement> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Non authentifié");
  const { data, error } = await supabase
    .from("group_announcements")
    .insert({ group_id: groupId, author_user_id: uid, title: title.trim(), body: body.trim(), pinned })
    .select("*, author:profiles!group_announcements_author_user_id_fkey(full_name, avatar_url)")
    .single();
  if (error) throw error;
  return data as DbAnnouncement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from("group_announcements").delete().eq("id", id);
  if (error) throw error;
}

export async function togglePinAnnouncement(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.from("group_announcements").update({ pinned }).eq("id", id);
  if (error) throw error;
}