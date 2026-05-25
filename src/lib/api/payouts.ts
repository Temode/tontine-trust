import { supabase } from "@/integrations/supabase/client";
import type { DbPaymentProvider } from "./payments";

export interface DbReceipt {
  id: string;
  receipt_number: string;
  turn_id: string;
  group_id: string;
  group_name: string;
  amount: number;
  provider: DbPaymentProvider;
  hash: string;
  issued_at: string;
  turn_number: number;
  beneficiary_user_id: string;
  beneficiary_name: string | null;
  issued_by_name: string | null;
}

export interface DbLedgerRow {
  id: string;
  seq: number;
  group_id: string;
  turn_id: string | null;
  payment_id: string | null;
  user_id: string | null;
  entry_type:
    | "contribution_in"
    | "payout_out"
    | "fee"
    | "refund"
    | "penalty"
    | "adjustment";
  amount: number;
  balance_after: number | null;
  memo: string | null;
  created_at: string;
  user_name: string | null;
  turn_number: number | null;
}

export interface DbTurnSettlement {
  turn_id: string;
  group_id: string;
  cycle_id: string;
  turn_number: number;
  status: "upcoming" | "collecting" | "paid" | "skipped";
  beneficiary_user_id: string;
  payout_amount: number;
  due_date: string;
  paid_at: string | null;
  expected_count: number;
  confirmed_count: number;
  collected_amount: number;
  receipt_id: string | null;
}

export async function releasePayout(
  turnId: string,
  provider: DbPaymentProvider = "simulation",
): Promise<string> {
  const { data, error } = await supabase.rpc("release_payout", {
    _turn_id: turnId,
    _provider: provider,
  });
  if (error) throw error;
  return data as string;
}

export async function listGroupLedger(groupId: string, limit = 50): Promise<DbLedgerRow[]> {
  const { data, error } = await supabase
    .from("group_ledger_view")
    .select("*")
    .eq("group_id", groupId)
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DbLedgerRow[];
}

export async function listMyReceipts(): Promise<DbReceipt[]> {
  const { data, error } = await supabase.from("my_receipts").select("*");
  if (error) throw error;
  return (data ?? []) as DbReceipt[];
}

export async function getReceiptById(id: string): Promise<DbReceipt | null> {
  const { data, error } = await supabase
    .from("my_receipts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as DbReceipt | null;
}

export async function getTurnSettlement(turnId: string): Promise<DbTurnSettlement | null> {
  const { data, error } = await supabase
    .from("turn_settlement")
    .select("*")
    .eq("turn_id", turnId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as DbTurnSettlement | null;
}