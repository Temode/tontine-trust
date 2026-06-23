import { supabase } from "@/integrations/supabase/client";

export type DisputeExportStatus = "queued" | "processing" | "ready" | "failed";

export interface DisputeExportRow {
  id: string;
  group_id: string;
  member_id: string;
  requested_by: string;
  reason: string;
  status: DisputeExportStatus;
  pdf_path: string | null;
  sha256: string | null;
  signed_url: string | null;
  expires_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export async function requestDisputeExport(groupId: string, memberId: string, reason: string): Promise<string> {
  const { data, error } = await supabase.rpc("request_dispute_export", {
    _group_id: groupId, _member_id: memberId, _reason: reason,
  });
  if (error) throw error;
  const id = data as string;
  // Déclenche la génération en arrière-plan (l'edge function met à jour le statut).
  void supabase.functions.invoke("generate-dispute-pdf", { body: { export_id: id } })
    .catch((e) => console.warn("[disputeExports] async invoke failed", e));
  return id;
}

export async function listDisputeExports(groupId?: string): Promise<DisputeExportRow[]> {
  let q = supabase.from("dispute_exports").select("*").order("created_at", { ascending: false });
  if (groupId) q = q.eq("group_id", groupId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DisputeExportRow[];
}

export async function getDisputeExport(id: string): Promise<DisputeExportRow | null> {
  const { data, error } = await supabase.from("dispute_exports").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as DisputeExportRow | null) ?? null;
}