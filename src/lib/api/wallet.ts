import { supabase } from "@/integrations/supabase/client";

export type WithdrawalChannel =
  | "mobile_money_om"
  | "mobile_money_momo"
  | "card"
  | "bank_transfer";

export type UserWithdrawalStatus = "pending" | "completed" | "rejected";

export interface UserWallet {
  available_amount: number;
  locked_amount: number;
  total_credited: number;
  total_withdrawn: number;
}

export interface UserWithdrawal {
  id: string;
  user_id: string;
  amount: number;
  payment_method: WithdrawalChannel;
  payment_details: Record<string, string>;
  status: UserWithdrawalStatus;
  rejection_reason: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminWithdrawalRow {
  id: string;
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  amount: number;
  payment_method: WithdrawalChannel;
  payment_details: Record<string, string>;
  status: UserWithdrawalStatus;
  rejection_reason: string | null;
  processed_at: string | null;
  created_at: string;
}

export async function getMyWallet(): Promise<UserWallet> {
  const { data, error } = await supabase.rpc("get_my_wallet");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    available_amount: Number(row?.available_amount ?? 0),
    locked_amount: Number(row?.locked_amount ?? 0),
    total_credited: Number(row?.total_credited ?? 0),
    total_withdrawn: Number(row?.total_withdrawn ?? 0),
  };
}

export async function listMyUserWithdrawals(): Promise<UserWithdrawal[]> {
  const { data, error } = await supabase
    .from("user_withdrawal_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as UserWithdrawal[];
}

export async function requestUserWithdrawal(args: {
  amount: number;
  method: WithdrawalChannel;
  details: Record<string, string>;
}): Promise<string> {
  const { data, error } = await supabase.rpc("request_user_withdrawal", {
    _amount: args.amount,
    _method: args.method,
    _details: args.details,
  });
  if (error) throw error;
  const id = data as string;
  // Fire-and-forget notification
  supabase.functions
    .invoke("notify-withdrawal", { body: { event: "submitted", id } })
    .catch((e) => console.warn("notify-withdrawal submitted failed", e));
  return id;
}

export async function adminListWithdrawals(
  status?: UserWithdrawalStatus,
): Promise<AdminWithdrawalRow[]> {
  const { data, error } = await supabase.rpc("admin_list_withdrawals", {
    _status: status ?? null,
  });
  if (error) throw error;
  return (data ?? []) as AdminWithdrawalRow[];
}

export async function adminMarkWithdrawalPaid(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_mark_withdrawal_paid", { _id: id });
  if (error) throw error;
  supabase.functions
    .invoke("notify-withdrawal", { body: { event: "completed", id } })
    .catch((e) => console.warn("notify-withdrawal completed failed", e));
}

export async function adminRejectWithdrawal(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("admin_reject_withdrawal", {
    _id: id,
    _reason: reason,
  });
  if (error) throw error;
  supabase.functions
    .invoke("notify-withdrawal", { body: { event: "rejected", id } })
    .catch((e) => console.warn("notify-withdrawal rejected failed", e));
}

export const CHANNEL_LABEL: Record<WithdrawalChannel, string> = {
  mobile_money_om: "Orange Money",
  mobile_money_momo: "MTN MoMo",
  card: "Carte bancaire",
  bank_transfer: "Virement bancaire",
};

export function formatDestination(
  method: WithdrawalChannel,
  details: Record<string, string>,
): string {
  switch (method) {
    case "mobile_money_om":
    case "mobile_money_momo":
      return details.phone ?? "—";
    case "card":
      return `${details.cardholder_name ?? ""} · ${maskCard(details.card_number ?? "")}`;
    case "bank_transfer":
      return `${details.bank_name ?? ""} · ${details.account_number ?? ""} · ${details.account_holder ?? ""}`;
  }
}

function maskCard(n: string): string {
  const digits = n.replace(/\D/g, "");
  if (digits.length < 6) return digits;
  return `**** **** **** ${digits.slice(-4)}`;
}