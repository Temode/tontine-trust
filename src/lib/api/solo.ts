import { supabase } from "@/integrations/supabase/client";

export type SoloMode = "project" | "working_capital";
export type SoloFrequency = "quotidienne" | "hebdomadaire" | "quinzaine" | "mensuelle";

export interface SoloGroup {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  contribution_amount: number;
  frequency: SoloFrequency;
  solo_mode: SoloMode | null;
  solo_lock_until: string | null;
  created_at: string;
  status: string;
  total_saved: number;
  target_amount: number | null;
}

export interface SoloGroupDetail {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  solo_mode: SoloMode | null;
  solo_lock_until: string | null;
  target_amount: number | null;
  created_at: string;
  status: string;
  total_saved: number;
  pending_amount: number;
  deposits_count: number;
}

export interface SoloDeposit {
  id: string;
  amount: number;
  status: "pending" | "confirmed" | "failed" | "cancelled";
  payment_method: string | null;
  djomy_transaction_id: string | null;
  confirmed_at: string | null;
  created_at: string;
}

export async function listMySoloGroups(): Promise<SoloGroup[]> {
  const { data, error } = await supabase.rpc("list_my_solo_groups");
  if (error) throw error;
  return ((data ?? []) as unknown as SoloGroup[]);
}

export async function getMySoloGroup(groupId: string): Promise<SoloGroupDetail | null> {
  const { data, error } = await supabase.rpc("get_my_solo_group" as never, { _group_id: groupId } as never);
  if (error) throw buildSoloError(error.message);
  const rows = (data ?? []) as unknown as SoloGroupDetail[];
  return rows[0] ?? null;
}

export async function listSoloDeposits(groupId: string, limit = 50): Promise<SoloDeposit[]> {
  const { data, error } = await supabase.rpc(
    "list_solo_deposits" as never,
    { _group_id: groupId, _limit: limit } as never,
  );
  if (error) throw buildSoloError(error.message);
  return ((data ?? []) as unknown as SoloDeposit[]);
}

export async function updateMySoloGroup(input: {
  groupId: string;
  name?: string;
  description?: string;
  targetAmount?: number | null;
  clearTarget?: boolean;
  lockUntil?: string | null;
  clearLock?: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc("update_my_solo_group" as never, {
    _group_id: input.groupId,
    _name: input.name ?? null,
    _description: input.description ?? null,
    _target_amount: input.targetAmount ?? null,
    _clear_target: input.clearTarget ?? false,
    _lock_until: input.lockUntil ?? null,
    _clear_lock: input.clearLock ?? false,
  } as never);
  if (error) throw buildSoloError(error.message);
}

export async function createSoloGroup(input: {
  name: string;
  description?: string;
  category?: string;
  mode: SoloMode;
  targetAmount?: number | null;
  lockUntil?: string | null;
}): Promise<{ groupId: string }> {
  const { data, error } = await supabase.rpc("create_solo_group", {
    _name: input.name,
    _description: input.description ?? "",
    _category: input.category ?? "",
    _mode: input.mode,
    _contribution: 0,
    _frequency: "mensuelle",
    _lock_until: input.mode === "project" ? (input.lockUntil ?? null) : null,
    _target_amount: input.targetAmount ?? null,
  } as never);
  if (error) throw buildSoloError(error.message);
  const r = data as { group_id: string } | null;
  if (!r?.group_id) throw new Error("Réponse serveur invalide.");
  return { groupId: r.group_id };
}

/** Démarre un dépôt libre puis renvoie l'URL de paiement Djomy. */
export async function startSoloDeposit(groupId: string, amount: number): Promise<{ redirectUrl: string; depositId: string }> {
  const base =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? window.location.origin
      : ((import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(/\/$/, "") ??
        "https://tontine-digitale.lovable.app");

  const { data, error } = await supabase.functions.invoke<
    { depositId: string; redirectUrl: string } | { error: string }
  >("djomy-init-solo-deposit", {
    body: {
      groupId,
      amount,
      returnUrl: `${base}/solo/${groupId}`,
      cancelUrl: `${base}/solo/${groupId}`,
    },
  });
  if (error) throw buildSoloError(error.message ?? "DJOMY_INIT_FAILED");
  if (!data || "error" in data) throw buildSoloError((data as { error?: string })?.error ?? "DJOMY_INIT_FAILED");
  return data;
}

export interface SoloQuotaError extends Error {
  code?: "QUOTA_SOLO_EXCEEDED";
  used?: number;
  max?: number;
  plan?: string;
}

/** Parse `QUOTA_SOLO_EXCEEDED:used/max:plan` renvoyé par la RPC serveur. */
export function parseSoloQuota(msg: string): { used: number; max: number; plan: string } | null {
  const m = msg.match(/QUOTA_SOLO_EXCEEDED:(\d+)\/(-?\d+)(?::([a-z_]+))?/);
  if (!m) return null;
  return { used: Number(m[1]), max: Number(m[2]), plan: m[3] ?? "free" };
}

function buildSoloError(msg: string): SoloQuotaError {
  const err: SoloQuotaError = new Error(translateSoloError(msg));
  const quota = parseSoloQuota(msg);
  if (quota) {
    err.code = "QUOTA_SOLO_EXCEEDED";
    err.used = quota.used;
    err.max = quota.max;
    err.plan = quota.plan;
  }
  return err;
}

export function translateSoloError(msg: string): string {
  const quota = parseSoloQuota(msg);
  if (quota) {
    return quota.max <= 0
      ? "Votre plan actuel n'inclut pas la tontine Solo. Passez au plan Premium ou Business pour en créer une."
      : `Quota Solo atteint (${quota.used}/${quota.max}). Passez à un plan supérieur pour créer une nouvelle tontine Solo.`;
  }
  if (msg.includes("QUOTA_SOLO_EXCEEDED")) {
    return "Votre plan actuel n'inclut pas de tontine Solo (ou le quota est atteint). Passez à un plan supérieur pour en créer une.";
  }
  if (msg.includes("QUOTA_MEMBERS_EXCEEDED")) return "Quota de membres atteint pour votre plan.";
  if (msg.includes("QUOTA_GROUPS_EXCEEDED")) return "Vous avez atteint le nombre maximum de tontines de votre plan.";
  if (msg.includes("INVALID_SOLO_LOCK_UNTIL")) return "Choisissez une date d'échéance future.";
  if (msg.includes("INVALID_TARGET_AMOUNT")) return "L'objectif d'épargne doit être supérieur à zéro.";
  if (msg.includes("INVALID_AMOUNT")) return "Le montant du dépôt doit être supérieur à zéro.";
  if (msg.includes("SOLO_NOT_FOUND")) return "Épargne Solo introuvable.";
  if (msg.includes("SOLO_ARCHIVED")) return "Cette épargne Solo est archivée.";
  if (msg.includes("SOLO_LOCKED_UNTIL")) return "L'échéance d'une épargne Projet ne peut pas être retirée avant son terme.";
  if (msg.includes("RETURN_URL_NOT_HTTPS")) return "Le paiement nécessite une URL sécurisée (https). Ouvrez l'application publiée.";
  if (msg.includes("membres doit être compris")) return msg;
  if (msg.includes("NAME_REQUIRED")) return "Le nom est requis.";
  if (msg.includes("AUTH_REQUIRED")) return "Vous devez être connecté.";
  return msg;
}
