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

// ---- Admin ----
export interface AdminReferralRow {
  id: string;
  referrer_id: string;
  referrer_name: string | null;
  referrer_code: string | null;
  referred_id: string;
  referred_name: string | null;
  status: "pending" | "active" | "expired" | "revoked";
  commission_percent: number;
  created_at: string;
  total_earned: number;
  pending_amount: number;
  paid_amount: number;
}

export interface AdminEarningRow {
  id: string;
  referrer_id: string;
  referrer_name: string | null;
  subscription_id: string;
  referred_id: string | null;
  referred_name: string | null;
  period: string;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  created_at: string;
}

export interface AuditIssue {
  entry_id?: string;
  earning_id?: string;
  issue: string;
  [k: string]: unknown;
}

export async function adminListReferrals(status?: string, search?: string): Promise<AdminReferralRow[]> {
  const { data, error } = await supabase.rpc("admin_list_referrals", {
    _status: status || null,
    _search: search || null,
  });
  if (error) throw error;
  return (data ?? []) as unknown as AdminReferralRow[];
}

export async function adminListReferralEarnings(paid?: boolean, referrerId?: string): Promise<AdminEarningRow[]> {
  const { data, error } = await supabase.rpc("admin_list_referral_earnings", {
    _paid: paid ?? null,
    _referrer_id: referrerId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as unknown as AdminEarningRow[];
}

export async function adminMarkEarningPaid(id: string, paid: boolean): Promise<void> {
  const { error } = await supabase.rpc("admin_mark_referral_earning_paid", { _id: id, _paid: paid });
  if (error) throw error;
}

export async function adminSetReferralStatus(id: string, status: "pending"|"active"|"expired"|"revoked"): Promise<void> {
  const { error } = await supabase.rpc("admin_set_referral_status", { _id: id, _status: status });
  if (error) throw error;
}

export async function auditCoordinatorCommissions(): Promise<AuditIssue[]> {
  const { data, error } = await supabase.rpc("audit_coordinator_commissions");
  if (error) throw error;
  return (data ?? []) as unknown as AuditIssue[];
}

export async function auditReferralEarnings(): Promise<AuditIssue[]> {
  const { data, error } = await supabase.rpc("audit_referral_earnings");
  if (error) throw error;
  return (data ?? []) as unknown as AuditIssue[];
}
