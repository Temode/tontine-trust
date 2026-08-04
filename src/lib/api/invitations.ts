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
  RATE_LIMITED: "Trop de tentatives. Réessayez dans quelques minutes.",
  INVALID_OPERATOR: "Opérateur Mobile Money invalide.",
  MESSAGE_TOO_LONG: "Message trop long (280 caractères max.).",
  TERMS_REQUIRED: "Vous devez accepter les conditions générales d'utilisation.",
  TERMS_VERSION_UNKNOWN: "Version des CGU inconnue.",
  KYC_INSUFFICIENT:
    "Votre niveau de vérification (KYC) est insuffisant pour rejoindre cette tontine. Vérifiez votre identité dans Profil → Vérification d'identité.",
};

export interface JoinWithCodeOptions {
  operator?: "orange" | "mtn" | null;
  message?: string | null;
  acceptedTermsVersion?: string;
}

export async function joinWithCode(
  code: string,
  options: JoinWithCodeOptions = {},
): Promise<{ groupId: string }> {
  const { CURRENT_TERMS_VERSION } = await import("./privacy");
  const { data, error } = await supabase.rpc("join_group_with_code", {
    _code: code,
    _operator: options.operator ?? null,
    _message: options.message ?? null,
    _accepted_terms_version: options.acceptedTermsVersion ?? CURRENT_TERMS_VERSION,
  });
  if (error) {
    const key = Object.keys(RPC_ERROR_LABELS).find((k) => error.message.includes(k));
    throw new Error(key ? RPC_ERROR_LABELS[key] : error.message);
  }
  return { groupId: data as string };
}

export type JoinStatus = "active" | "pending";

export async function joinWithCodeAndStatus(
  code: string,
  options: JoinWithCodeOptions = {},
): Promise<{ groupId: string; status: JoinStatus }> {
  const { groupId } = await joinWithCode(code, options);
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return { groupId, status: "active" };
  const { data } = await supabase
    .from("group_members")
    .select("status")
    .eq("group_id", groupId)
    .eq("user_id", uid)
    .maybeSingle();
  const status = (data?.status as JoinStatus | undefined) ?? "pending";
  return { groupId, status };
}

export { generateInviteCode };

export interface InvitationPreview {
  name: string;
  description: string | null;
  contribution_amount: number;
  frequency: "hebdomadaire" | "quinzaine" | "mensuelle";
  max_members: number;
  members_count: number;
  visibility: "private" | "public-link" | "directory";
  organizer_name: string;
}

/** Charge un aperçu lecture seule du groupe associé à un code d'invitation. */
export async function previewByCode(code: string): Promise<InvitationPreview> {
  const { data, error } = await supabase.rpc("preview_group_by_code", { _code: code });
  if (error) {
    const key = Object.keys(RPC_ERROR_LABELS).find((k) => error.message.includes(k));
    throw new Error(key ? RPC_ERROR_LABELS[key] : error.message);
  }
  return data as unknown as InvitationPreview;
}