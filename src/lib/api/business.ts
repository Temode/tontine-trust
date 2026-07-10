import { supabase } from "@/integrations/supabase/client";

export interface CoordinatorCommission {
  entry_id: string;
  group_id: string;
  group_name: string;
  amount: number;
  cycle_id: string | null;
  turn_id: string | null;
  created_at: string;
  memo: string | null;
}

export interface AffiliateSummary {
  referral_code: string | null;
  referrals_count: number;
  active_count: number;
  total_earned: number;
  pending: number;
  paid: number;
}

export interface AffiliateEarning {
  id: string;
  subscription_id: string;
  period: string;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  created_at: string;
  referred_full_name: string | null;
}

export async function createBusinessGroup(input: {
  name: string;
  description?: string;
  category?: string;
  contribution: number;
  frequency: "quotidienne" | "hebdomadaire" | "quinzaine" | "mensuelle";
  maxMembers: number;
  commissionPercent: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_business_group", {
    _name: input.name,
    _description: input.description ?? "",
    _category: input.category ?? "",
    _contribution: input.contribution,
    _frequency: input.frequency,
    _max_members: input.maxMembers,
    _commission_percent: input.commissionPercent,
  });
  if (error) throw new Error(translateBusinessError(error.message));
  return data as unknown as string;
}

export async function listMyCoordinatorCommissions(): Promise<CoordinatorCommission[]> {
  const { data, error } = await supabase.rpc("list_my_coordinator_commissions");
  if (error) throw error;
  return (data ?? []) as unknown as CoordinatorCommission[];
}

export async function getMyAffiliateSummary(): Promise<AffiliateSummary> {
  const { data, error } = await supabase.rpc("get_my_affiliate_summary");
  if (error) throw error;
  return data as unknown as AffiliateSummary;
}

export async function listMyAffiliateEarnings(): Promise<AffiliateEarning[]> {
  const { data, error } = await supabase.rpc("list_my_affiliate_earnings");
  if (error) throw error;
  return (data ?? []) as unknown as AffiliateEarning[];
}

export async function registerReferral(code: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("register_referral", { _code: code });
  if (error) {
    // silent-friendly errors
    if (/already_referred|self_referral|referrer_not_found|invalid_code/.test(error.message)) return null;
    throw error;
  }
  return data as unknown as string;
}

function translateBusinessError(msg: string): string {
  if (msg.includes("business_plan_required")) return "Un abonnement Business est requis pour créer ce type de groupe.";
  if (msg.includes("invalid_commission_percent")) return "Commission invalide (0 à 20%).";
  if (msg.includes("invalid_max_members")) return "Nombre de membres invalide.";
  if (msg.includes("not_authenticated")) return "Vous devez être connecté.";
  return msg;
}
