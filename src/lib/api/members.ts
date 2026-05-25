import { supabase } from "@/integrations/supabase/client";
import type { DbGroupMember } from "./types";

export async function listGroupMembers(groupId: string): Promise<DbGroupMember[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("id, group_id, user_id, role, status, position, joined_at, profile:profiles(full_name, phone_number)")
    .eq("group_id", groupId)
    .in("status", ["active", "pending"])
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as DbGroupMember[];
}

export async function approveMember(memberId: string): Promise<void> {
  const { error } = await supabase.rpc("approve_member", { _member_id: memberId });
  if (error) throw error;
}

export async function rejectMember(memberId: string): Promise<void> {
  const { error } = await supabase.rpc("reject_member", { _member_id: memberId });
  if (error) throw error;
}

export async function startCycle(groupId: string): Promise<string> {
  const { data, error } = await supabase.rpc("start_cycle", { _group_id: groupId });
  if (error) throw error;
  return data as string;
}