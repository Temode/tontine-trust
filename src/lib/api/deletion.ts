import { supabase } from "@/integrations/supabase/client";

export type DeletionStatus =
  | "pending_members"
  | "pending_admin"
  | "approved"
  | "rejected"
  | "cancelled";

export interface DeletionRequest {
  id: string;
  group_id: string;
  requested_by: string;
  reason: string;
  status: DeletionStatus;
  members_deadline: string;
  admin_decision_by: string | null;
  admin_decision_at: string | null;
  admin_decision_reason: string | null;
  created_at: string;
}

export interface DeletionVote {
  request_id: string;
  user_id: string;
  vote: "yes" | "no";
  voted_at: string;
}

export interface AdminDeletionRow {
  id: string;
  group_id: string;
  group_name: string;
  contribution_amount: number;
  frequency: string;
  max_members: number;
  requested_by: string;
  requester_name: string | null;
  reason: string;
  status: DeletionStatus;
  members_deadline: string;
  admin_decision_by: string | null;
  admin_decision_at: string | null;
  admin_decision_reason: string | null;
  created_at: string;
  yes_votes: number;
  no_votes: number;
  active_members: number;
}

const ERR: Record<string, string> = {
  AUTH_REQUIRED: "Connexion requise.",
  REASON_REQUIRED: "Le motif est obligatoire.",
  GROUP_NOT_FOUND: "Groupe introuvable.",
  ALREADY_DELETED: "Ce groupe est déjà supprimé.",
  FORBIDDEN: "Seul l'organisateur peut effectuer cette action.",
  DIRECT_GROUP_STATUS_UPDATE_FORBIDDEN:
    "La base a bloqué le changement de statut direct de la tontine.",
  OPEN_TURNS_REMAIN: "Un tour est en cours : impossible de demander la suppression.",
  PENDING_CONTRIBUTIONS: "Des cotisations sont encore en attente.",
  PENDING_PAYMENT_LINKS: "Des paiements sont en cours de traitement.",
  REQUEST_ALREADY_OPEN: "Une demande de suppression est déjà en cours.",
  REQUEST_NOT_FOUND: "Demande introuvable.",
  VOTE_CLOSED: "Le vote est clos.",
  NOT_A_MEMBER: "Vous n'êtes pas membre actif de ce groupe.",
  NOT_PENDING_ADMIN: "Cette demande n'est pas en attente d'une décision admin.",
};

function translate(msg: string): string {
  const k = Object.keys(ERR)
    .sort((a, b) => b.length - a.length)
    .find((k) => msg === k || msg.includes(k));
  return k ? ERR[k] : msg;
}

export async function getActiveDeletionRequest(
  groupId: string,
): Promise<DeletionRequest | null> {
  const { data, error } = await supabase
    .from("group_deletion_requests" as never)
    .select("*")
    .eq("group_id", groupId)
    .in("status", ["pending_members", "pending_admin"])
    .maybeSingle();
  if (error) throw new Error(translate(error.message));
  return (data as DeletionRequest | null) ?? null;
}

export async function listVotes(requestId: string): Promise<DeletionVote[]> {
  const { data, error } = await supabase
    .from("group_deletion_votes" as never)
    .select("*")
    .eq("request_id", requestId);
  if (error) throw new Error(translate(error.message));
  return (data ?? []) as DeletionVote[];
}

export async function requestGroupDeletion(
  groupId: string,
  reason: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("request_group_deletion" as never, {
    _group_id: groupId,
    _reason: reason,
  } as never);
  if (error) throw new Error(translate(error.message));
  return data as unknown as string;
}

export async function voteGroupDeletion(
  requestId: string,
  vote: "yes" | "no",
): Promise<void> {
  const { error } = await supabase.rpc("vote_group_deletion" as never, {
    _request_id: requestId,
    _vote: vote,
  } as never);
  if (error) throw new Error(translate(error.message));
}

export async function adminDecideDeletion(
  requestId: string,
  approve: boolean,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc("admin_decide_deletion" as never, {
    _request_id: requestId,
    _approve: approve,
    _reason: reason ?? null,
  } as never);
  if (error) throw new Error(translate(error.message));
}

export async function listAdminQueue(): Promise<AdminDeletionRow[]> {
  const { data, error } = await supabase
    .from("deletion_requests_admin_view" as never)
    .select("*")
    .eq("status", "pending_admin")
    .order("created_at", { ascending: false });
  if (error) throw new Error(translate(error.message));
  return (data ?? []) as AdminDeletionRow[];
}