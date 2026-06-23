import { supabase } from "@/integrations/supabase/client";

export interface MemberDeposit {
  id: string;
  group_id: string;
  user_id: string;
  amount: number;
  months: number;
  status: "pending" | "paid" | "failed" | "cancelled" | "refunded" | "forfeited";
  djomy_transaction_id: string | null;
  redirect_url: string | null;
  payment_method: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  refund_reason: string | null;
  forfeited_at: string | null;
  forfeit_reason: string | null;
  created_at: string;
  updated_at: string;
}

/** Caution courante du membre connecté pour ce groupe (la plus récente). */
export async function getMyDepositForGroup(groupId: string): Promise<MemberDeposit | null> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("member_deposits")
    .select("*")
    .eq("group_id", groupId)
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as MemberDeposit | null) ?? null;
}

/** Lance un dépôt de caution via Djomy : renvoie l'URL de redirection. */
export async function startDepositCheckout(input: {
  groupId: string;
  payerPhone: string;
  method?: "OM" | "MOMO" | "CARD";
  returnUrl: string;
  cancelUrl?: string;
}): Promise<{ depositId: string; redirectUrl: string; amount: number; months: number }> {
  const { data, error } = await supabase.functions.invoke("djomy-init-deposit", {
    body: input,
  });
  if (error) throw error;
  const res = data as { depositId: string; redirectUrl: string; amount: number; months: number; error?: string };
  if (res.error || !res.redirectUrl) throw new Error(res.error ?? "DEPOSIT_INIT_FAILED");
  return res;
}

export async function refundDeposit(depositId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("admin_refund_member_deposit", {
    _deposit_id: depositId,
    _reason: reason ?? null,
  });
  if (error) throw error;
}

export async function forfeitDeposit(depositId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("admin_forfeit_member_deposit", {
    _deposit_id: depositId,
    _reason: reason,
  });
  if (error) throw error;
}

export interface AdminDepositRow {
  deposit_id: string;
  group_id: string;
  group_name: string;
  user_id: string;
  user_full_name: string | null;
  user_phone: string | null;
  amount: number;
  months: number;
  status: MemberDeposit["status"];
  payment_method: string | null;
  djomy_transaction_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  member_deposit_status: string | null;
}

/** Liste enrichie des cautions — réservé super-admin (RPC sécurisée). */
export async function adminListDeposits(filters?: {
  status?: MemberDeposit["status"] | null;
  groupId?: string | null;
  limit?: number;
}): Promise<AdminDepositRow[]> {
  const { data, error } = await supabase.rpc("admin_list_deposits", {
    _status: filters?.status ?? null,
    _group_id: filters?.groupId ?? null,
    _limit: filters?.limit ?? 200,
  });
  if (error) throw error;
  return (data ?? []) as AdminDepositRow[];
}

/** Forcer la régularisation d'un dépôt (motif ≥ 10 caractères obligatoire). */
export async function adminForceDepositStatus(
  depositId: string,
  newStatus: "pending" | "paid" | "failed" | "cancelled",
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("admin_force_deposit_status", {
    _deposit_id: depositId,
    _new_status: newStatus,
    _reason: reason,
  });
  if (error) throw error;
}

export interface MemberPositionInfo {
  user_id: string;
  member_position: number | null;
  total_active: number;
  max_members: number;
  last_third_start: number;
  is_in_last_third: boolean;
  joined_after_start: boolean;
  deposit_required: boolean;
  deposit_status: string | null;
  withdrawal_locked: boolean;
  lock_reason: string | null;
}

/** Rang du membre + verrou caution. Si _userId omis, prend l'utilisateur connecté. */
export async function getMemberPositionInfo(
  groupId: string,
  userId?: string,
): Promise<MemberPositionInfo | null> {
  const { data, error } = await supabase.rpc("get_member_position_info", {
    _group_id: groupId,
    _user_id: userId ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as MemberPositionInfo | null) ?? null;
}