import { supabase } from "@/integrations/supabase/client";
import type { DbGroupMember } from "./types";

export async function listGroupMembers(groupId: string): Promise<DbGroupMember[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("id, group_id, user_id, role, status, position, joined_at, suspended_at, suspended_reason, can_chat, can_bid, can_swap, can_invite, profile:profiles!group_members_user_id_profile_fkey(full_name, phone_number)")
    .eq("group_id", groupId)
    .in("status", ["active", "pending", "suspended"])
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

export async function suspendMember(memberId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("suspend_member", {
    _member_id: memberId,
    _reason: reason ?? null,
  });
  if (error) throw error;
}

export async function reactivateMember(memberId: string): Promise<void> {
  const { error } = await supabase.rpc("reactivate_member", { _member_id: memberId });
  if (error) throw error;
}

export async function kickMember(memberId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("kick_member", {
    _member_id: memberId,
    _reason: reason ?? null,
  });
  if (error) throw error;
}

export interface MemberPermissions {
  can_chat?: boolean;
  can_bid?: boolean;
  can_swap?: boolean;
  can_invite?: boolean;
}

export async function setMemberPermissions(memberId: string, perms: MemberPermissions): Promise<void> {
  const { error } = await supabase.rpc("set_member_permissions", {
    _member_id: memberId,
    _perms: perms as unknown as Record<string, unknown>,
  });
  if (error) throw error;
}

export async function transferOwnership(groupId: string, newOwnerUserId: string): Promise<void> {
  const { error } = await supabase.rpc("transfer_ownership", {
    _group_id: groupId,
    _new_owner_user_id: newOwnerUserId,
  });
  if (error) throw error;
}