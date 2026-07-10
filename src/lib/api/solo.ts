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
  if (error) throw new Error(translateSoloError(error.message));
  const r = data as { group_id: string } | null;
  if (!r?.group_id) throw new Error("Réponse serveur invalide.");
  return { groupId: r.group_id };
}

function translateSoloError(msg: string): string {
  if (msg.includes("QUOTA_SOLO_EXCEEDED")) return "Vous avez atteint le quota de tontines Solo de votre plan.";
  if (msg.includes("INVALID_SOLO_LOCK_UNTIL")) return "Choisissez une date d'échéance future.";
  if (msg.includes("INVALID_CONTRIBUTION")) return "La cotisation doit être supérieure à zéro.";
  if (msg.includes("NAME_REQUIRED")) return "Le nom est requis.";
  if (msg.includes("AUTH_REQUIRED")) return "Vous devez être connecté.";
  return msg;
}