import { supabase } from "@/integrations/supabase/client";

export type ReliabilityTier = "nouveau" | "risque" | "moyen" | "bon" | "excellent";

export interface DbReliability {
  user_id: string;
  score: number;
  tier: ReliabilityTier;
  total_due: number;
  total_paid: number;
  total_on_time: number;
  total_late: number;
  avg_delay_days: number;
  cycles_completed: number;
  last_computed_at: string;
}

export interface DbGroupReliabilityRow {
  group_id: string;
  user_id: string;
  full_name: string | null;
  score: number;
  tier: ReliabilityTier;
  total_paid: number;
  total_late: number;
}

export interface DbLateContribution {
  contribution_id: string;
  group_id: string;
  group_name: string;
  turn_number: number;
  due_date: string;
  confirmed_at: string;
  delay_days: number;
  amount: number;
}

export async function getMyReliability(): Promise<DbReliability | null> {
  const { data, error } = await supabase.from("my_reliability").select("*").maybeSingle();
  if (error) throw error;
  return (data ?? null) as DbReliability | null;
}

export async function getGroupReliability(groupId: string): Promise<DbGroupReliabilityRow[]> {
  const { data, error } = await supabase
    .from("group_reliability")
    .select("*")
    .eq("group_id", groupId);
  if (error) throw error;
  return (data ?? []) as DbGroupReliabilityRow[];
}

export async function listMyLateContributions(): Promise<DbLateContribution[]> {
  const { data, error } = await supabase.from("my_late_contributions").select("*");
  if (error) throw error;
  return (data ?? []) as DbLateContribution[];
}

export async function recomputeMyReliability(): Promise<DbReliability> {
  const { data, error } = await supabase.rpc("recompute_reliability", {});
  if (error) throw error;
  return data as DbReliability;
}

export const TIER_LABEL: Record<ReliabilityTier, string> = {
  nouveau: "Nouveau",
  risque: "À risque",
  moyen: "Moyen",
  bon: "Bon",
  excellent: "Excellent",
};

export const TIER_CLASSES: Record<ReliabilityTier, string> = {
  nouveau: "bg-secondary text-muted-foreground",
  risque: "bg-destructive/10 text-destructive",
  moyen: "bg-accent-100 text-accent-700",
  bon: "bg-primary-50 text-primary-700",
  excellent: "bg-success/10 text-success",
};