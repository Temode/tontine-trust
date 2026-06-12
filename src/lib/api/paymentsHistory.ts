import { supabase } from "@/integrations/supabase/client";

export interface PaymentHistoryRow {
  contribution_id: string;
  group_id: string;
  turn_id: string;
  turn_number: number;
  due_date: string;
  payer_user_id: string;
  payer_name: string | null;
  amount: number;
  penalty_amount: number;
  contribution_status: string;
  provider: string | null;
  reference: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  confirmed_by_name: string | null;
}

export async function listGroupPaymentsHistory(groupId: string): Promise<PaymentHistoryRow[]> {
  const { data, error } = await supabase
    .from("group_payments_history")
    .select("*")
    .eq("group_id", groupId)
    .order("due_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PaymentHistoryRow[];
}