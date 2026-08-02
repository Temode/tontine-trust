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

export async function listMySoloGroups(): Promise<SoloGroup[]> {
  const { data, error } = await supabase.rpc("list_my_solo_groups");
  if (error) throw error;
  return ((data ?? []) as unknown as SoloGroup[]);
}

export async function createSoloGroup(input: {
  name: string;
  description?: string;
  category?: string;
  mode: SoloMode;
  contribution: number;
  frequency: SoloFrequency;
  lockUntil?: string | null;
}): Promise<{ groupId: string }> {
  const { data, error } = await supabase.rpc("create_solo_group", {
    _name: input.name,
    _description: input.description ?? "",
    _category: input.category ?? "",
    _mode: input.mode,
    _contribution: input.contribution,
    _frequency: input.frequency,
    _lock_until: input.mode === "project" ? (input.lockUntil ?? null) : null,
  });
  if (error) throw buildSoloError(error.message);
  const r = data as { group_id: string } | null;
  if (!r?.group_id) throw new Error("Réponse serveur invalide.");
  return { groupId: r.group_id };
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
  if (msg.includes("INVALID_CONTRIBUTION")) return "La cotisation doit être supérieure à zéro.";
  if (msg.includes("membres doit être compris")) return msg;
  if (msg.includes("NAME_REQUIRED")) return "Le nom est requis.";
  if (msg.includes("AUTH_REQUIRED")) return "Vous devez être connecté.";
  return msg;
}