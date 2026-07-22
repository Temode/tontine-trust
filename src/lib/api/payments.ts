import { supabase } from "@/integrations/supabase/client";
import type { MobileMoneyOperator } from "@/lib/types";

export type DbPaymentProvider = "orange_money" | "mtn_money" | "cash" | "simulation";
export type DbPaymentStatus =
  | "initiated"
  | "pending"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "refunded";

export function operatorToProvider(op: MobileMoneyOperator): DbPaymentProvider {
  return op === "orange" ? "orange_money" : "mtn_money";
}

/**
 * Phase C : paiement simulé (Djomy branché en Phase I).
 * Le RPC `record_mock_payment` enregistre payment + contribution + ledger.
 */
export async function payContribution(
  contributionId: string,
  provider: DbPaymentProvider = "simulation",
): Promise<string> {
  const { data, error } = await supabase.rpc("record_mock_payment", {
    _contribution_id: contributionId,
    _provider: provider,
  });
  if (error) throw error;
  return data as string;
}

export interface DbPaymentHistoryRow {
  payment_id: string;
  contribution_id: string;
  group_id: string;
  group_name: string;
  amount: number;
  provider: DbPaymentProvider;
  provider_ref: string | null;
  status: DbPaymentStatus;
  initiated_at: string;
  settled_at: string | null;
  turn_number: number;
}

export async function listMyPaymentsHistory(): Promise<DbPaymentHistoryRow[]> {
  const { data, error } = await supabase.from("my_payments_history").select("*");
  if (error) throw error;
  return (data ?? []) as DbPaymentHistoryRow[];
}
