import { supabase } from "@/integrations/supabase/client";

export interface DbMyBalance {
  id: string;
  user_id: string;
  group_id: string;
  group_name: string;
  available_amount: number;
  total_credited: number;
  total_withdrawn: number;
  updated_at: string;
}

export type WithdrawalMethod = "OM" | "MOMO" | "CARD" | "BANK" | "CASH";
export type WithdrawalStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled";

export interface DbWithdrawalRequest {
  id: string;
  user_id: string;
  group_id: string;
  amount: number;
  method: WithdrawalMethod;
  destination: string | null;
  status: WithdrawalStatus;
  djomy_payout_ref: string | null;
  notes: string | null;
  processed_at: string | null;
  created_at: string;
}

export async function listMyBalances(): Promise<DbMyBalance[]> {
  const { data, error } = await supabase
    .from("my_balances")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbMyBalance[];
}

export async function listMyWithdrawals(): Promise<DbWithdrawalRequest[]> {
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbWithdrawalRequest[];
}

export async function requestWithdrawal(args: {
  groupId: string;
  amount: number;
  method: WithdrawalMethod;
  destination?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("request_withdrawal", {
    _group_id: args.groupId,
    _amount: args.amount,
    _method: args.method,
    _destination: args.destination ?? null,
  });
  if (error) throw error;
  return data as string;
}