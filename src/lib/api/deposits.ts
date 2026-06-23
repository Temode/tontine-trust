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