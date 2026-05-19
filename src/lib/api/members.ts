import { supabase } from "@/integrations/supabase/client";
import type { DbGroupMember } from "./types";

export async function listGroupMembers(groupId: string): Promise<DbGroupMember[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("id, group_id, user_id, role, status, position, joined_at, profile:profiles(full_name, phone_number)")
    .eq("group_id", groupId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as DbGroupMember[];
}