import { supabase } from "@/integrations/supabase/client";

export interface ActiveContract {
  contract_id: string;
  group_id: string | null;
  version: string;
  body_md: string;
  is_default: boolean;
  published_at: string;
}

export interface ContractSignature {
  id: string;
  contract_id: string;
  user_id: string;
  group_id: string;
  signed_at: string;
  hash_sha256: string;
  otp_ref: string | null;
}

/** Renvoie le contrat applicable au groupe (surcharge groupe puis modèle plateforme). */
export async function getActiveContract(groupId: string): Promise<ActiveContract | null> {
  const { data, error } = await supabase.rpc("get_active_contract", { _group_id: groupId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as ActiveContract | null) ?? null;
}

/** Vérifie si l'utilisateur courant a déjà signé ce contrat. */
export async function getMyContractSignature(contractId: string): Promise<ContractSignature | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase
    .from("contract_signatures")
    .select("*")
    .eq("contract_id", contractId)
    .eq("user_id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as ContractSignature | null) ?? null;
}

/** Calcule un SHA-256 hex du texte signé (côté client, vérifié côté DB par longueur). */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signContract(input: {
  groupId: string;
  otpChallengeId: string;
  hashSha256: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("sign_contract", {
    _group_id: input.groupId,
    _otp_challenge_id: input.otpChallengeId,
    _hash_sha256: input.hashSha256,
    _ip: null,
    _user_agent: navigator.userAgent.slice(0, 500),
  });
  if (error) throw error;
  return data as string;
}

/** Admin : publie une nouvelle version par défaut du modèle plateforme. */
export async function adminPublishContractTemplate(version: string, bodyMd: string): Promise<string> {
  const { data, error } = await supabase.rpc("admin_publish_contract_template", {
    _version: version, _body_md: bodyMd,
  });
  if (error) throw error;
  return data as string;
}

/** Admin : liste les versions du modèle plateforme. */
export async function listPlatformTemplates(): Promise<ActiveContract[]> {
  const { data, error } = await supabase
    .from("group_contracts")
    .select("id, group_id, version, body_md, is_default, published_at")
    .is("group_id", null)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    contract_id: r.id, group_id: null,
    version: r.version, body_md: r.body_md,
    is_default: r.is_default, published_at: r.published_at,
  }));
}