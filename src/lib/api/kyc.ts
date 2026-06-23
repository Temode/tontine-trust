import { supabase } from "@/integrations/supabase/client";

export interface KycLevelConfig {
  level: number;
  label: string;
  max_contribution_amount: number;
  description: string | null;
}

export interface KycProfile {
  kyc_level: number;
  kyc_status: "none" | "pending" | "verified" | "rejected";
  phone_verified_at: string | null;
  kyc_verified_at: string | null;
}

export interface KycDocument {
  id: string;
  doc_type: string;
  document_number: string | null;
  country_code: string | null;
  storage_path: string;
  status: "pending" | "verified" | "rejected";
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface KycQueueRow {
  document_id: string;
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  current_level: number;
  doc_type: string;
  document_number: string | null;
  country_code: string | null;
  target_level: number;
  storage_path: string;
  status: "pending" | "verified" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
}

const ERR: Record<string, string> = {
  AUTH_REQUIRED: "Connexion requise.",
  INVALID_PHONE: "Numéro de téléphone invalide.",
  RATE_LIMITED: "Trop de demandes. Patientez 10 minutes.",
  SMS_FAILED: "L'envoi du SMS a échoué. Réessayez.",
  INVALID_CODE: "Code à 6 chiffres requis.",
  OTP_EXPIRED: "Code expiré. Demandez-en un nouveau.",
  OTP_LOCKED: "Trop de tentatives. Demandez un nouveau code.",
  OTP_MISMATCH: "Code incorrect.",
  INVALID_DOC_TYPE: "Type de document non accepté.",
  STORAGE_PATH_REQUIRED: "Aucun fichier reçu.",
  DOC_NOT_FOUND: "Document introuvable.",
  DOC_ALREADY_REVIEWED: "Document déjà traité.",
  FORBIDDEN: "Action non autorisée.",
  KYC_INSUFFICIENT: "Votre niveau KYC ne permet pas de rejoindre cette tontine.",
};
function tr(msg: string) {
  const k = Object.keys(ERR).find((k) => msg.includes(k));
  return k ? ERR[k] : msg;
}

export async function listKycLevels(): Promise<KycLevelConfig[]> {
  const { data, error } = await supabase
    .from("kyc_levels_config" as never)
    .select("level,label,max_contribution_amount,description")
    .order("level");
  if (error) throw new Error(tr(error.message));
  return (data ?? []) as unknown as KycLevelConfig[];
}

export async function getMyKyc(): Promise<KycProfile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  const { data, error } = await supabase
    .from("profiles")
    .select("kyc_level,kyc_status,phone_verified_at,kyc_verified_at" as never)
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(tr(error.message));
  return (data ?? { kyc_level: 0, kyc_status: "none", phone_verified_at: null, kyc_verified_at: null }) as unknown as KycProfile;
}

export async function listMyKycDocuments(): Promise<KycDocument[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("kyc_documents" as never)
    .select("id,doc_type,document_number,country_code,storage_path,status,review_note,reviewed_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(tr(error.message));
  return (data ?? []) as unknown as KycDocument[];
}

export async function sendPhoneOtp(phone: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("kyc-send-otp", { body: { phone } });
  if (error) throw new Error(tr(error.message));
  if ((data as { error?: string })?.error) throw new Error(tr((data as { error: string }).error));
}

export async function verifyPhoneOtp(code: string): Promise<number> {
  const { data, error } = await supabase.functions.invoke("kyc-verify-otp", { body: { code } });
  if (error) throw new Error(tr(error.message));
  const payload = data as { error?: string; kyc_level?: number };
  if (payload?.error) throw new Error(tr(payload.error));
  return payload?.kyc_level ?? 1;
}

export async function uploadKycFile(file: File, docType: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/${docType}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("kyc-documents")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(tr(error.message));
  return path;
}

export async function submitKycDocument(
  docType: string,
  storagePath: string,
  documentNumber: string | null,
  countryCode = "GN",
): Promise<string> {
  const { data, error } = await supabase.rpc("submit_kyc_document" as never, {
    _doc_type: docType,
    _storage_path: storagePath,
    _document_number: documentNumber,
    _country_code: countryCode,
  } as never);
  if (error) throw new Error(tr(error.message));
  return data as unknown as string;
}

export async function listKycAdminQueue(status?: "pending" | "verified" | "rejected"): Promise<KycQueueRow[]> {
  let q = supabase.from("kyc_admin_queue" as never).select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(tr(error.message));
  return (data ?? []) as unknown as KycQueueRow[];
}

export async function adminValidateKyc(documentId: string, approve: boolean, note?: string): Promise<void> {
  const { error } = await supabase.rpc("admin_validate_kyc" as never, {
    _document_id: documentId,
    _approve: approve,
    _note: note ?? null,
  } as never);
  if (error) throw new Error(tr(error.message));
}

export async function getKycDocumentSignedUrl(path: string, expiresIn = 300): Promise<string> {
  const { data, error } = await supabase.storage.from("kyc-documents").createSignedUrl(path, expiresIn);
  if (error) throw new Error(tr(error.message));
  return data.signedUrl;
}

export const KYC_LEVEL_LABEL: Record<number, string> = {
  0: "Non vérifié",
  1: "Découverte",
  2: "Vérifié",
};

export const DOC_TYPE_LABEL: Record<string, string> = {
  nina: "NINA",
  passport: "Passeport",
  voter_card: "Carte d'électeur",
  driver_license: "Permis de conduire",
  consular_card: "Carte consulaire",
};