import { supabase } from "@/integrations/supabase/client";
import type { DbInvitation } from "./types";

function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `TD-${s.slice(0, 4)}-${s.slice(4)}`;
}

export interface CreateInvitationInput {
  groupId: string;
  code?: string;
  maxUses?: number | null;
  expiresAt?: string | null;
}

export async function createInvitation(input: CreateInvitationInput): Promise<DbInvitation> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("AUTH_REQUIRED");

  const payload = {
    group_id: input.groupId,
    code: input.code ?? generateInviteCode(),
    created_by: uid,
    max_uses: input.maxUses ?? null,
    expires_at: input.expiresAt ?? null,
  };
  const { data, error } = await supabase.from("invitations").insert(payload).select("*").single();
  if (error) throw error;
  return data as DbInvitation;
}

export async function listGroupInvitations(groupId: string): Promise<DbInvitation[]> {
  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbInvitation[];
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await supabase.from("invitations").update({ status: "revoked" }).eq("id", id);
  if (error) throw error;
}

const RPC_ERROR_LABELS: Record<string, string> = {
  AUTH_REQUIRED: "Vous devez être connecté.",
  INVITATION_NOT_FOUND: "Code invalide ou introuvable.",
  INVITATION_INACTIVE: "Ce code a été révoqué.",
  INVITATION_EXPIRED: "Ce code a expiré.",
  INVITATION_EXHAUSTED: "Ce code a atteint son nombre maximum d'utilisations.",
  GROUP_FULL: "Ce groupe est complet.",
};

export async function joinWithCode(code: string): Promise<{ groupId: string }> {
  const { data, error } = await supabase.rpc("join_group_with_code", { _code: code });
  if (error) {
    const key = Object.keys(RPC_ERROR_LABELS).find((k) => error.message.includes(k));
    throw new Error(key ? RPC_ERROR_LABELS[key] : error.message);
  }
  return { groupId: data as string };
}

export { generateInviteCode };