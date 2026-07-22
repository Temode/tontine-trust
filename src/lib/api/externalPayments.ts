import { supabase } from "@/integrations/supabase/client";

export type ExternalMethod = "cash" | "bank_transfer" | "om_external" | "mtn_external" | "other";
export type ProofStatus = "pending" | "confirmed" | "rejected";

export const EXTERNAL_METHOD_LABEL: Record<ExternalMethod, string> = {
  cash: "Espèces",
  bank_transfer: "Virement bancaire",
  om_external: "Orange Money (hors-app)",
  mtn_external: "MTN Money (hors-app)",
  other: "Autre",
};

export interface ExternalProof {
  id: string;
  contribution_id: string;
  group_id: string;
  member_user_id: string;
  amount: number;
  method: ExternalMethod;
  reference: string | null;
  proof_url: string | null;
  note: string | null;
  status: ProofStatus;
  recorded_by: string;
  recorded_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
}

export async function listGroupProofs(groupId: string, status?: ProofStatus): Promise<ExternalProof[]> {
  let q = supabase.from("external_payment_proofs").select("*").eq("group_id", groupId);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("recorded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ExternalProof[];
}

export async function submitExternalPayment(input: {
  contributionId: string;
  amount: number;
  method: ExternalMethod;
  reference?: string;
  proofUrl?: string;
  note?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("submit_external_payment", {
    _contribution_id: input.contributionId,
    _amount: input.amount,
    _method: input.method,
    _reference: input.reference ?? null,
    _proof_url: input.proofUrl ?? null,
    _note: input.note ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function confirmExternalPayment(proofId: string): Promise<void> {
  const { error } = await supabase.rpc("confirm_external_payment", { _proof_id: proofId });
  if (error) throw error;
}

export async function rejectExternalPayment(proofId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("reject_external_payment", {
    _proof_id: proofId,
    _reason: reason ?? null,
  });
  if (error) throw error;
}

export async function uploadProofFile(groupId: string, file: File): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("NOT_AUTHENTICATED");
  const ext = file.name.split(".").pop() || "bin";
  const path = `${groupId}/${uid}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("payment-proofs").upload(path, file);
  if (error) throw error;
  return path;
}

export async function getProofSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}