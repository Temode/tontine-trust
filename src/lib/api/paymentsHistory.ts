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
  payment_id: string | null;
  djomy_transaction_id: string | null;
  payment_method: string | null;
  payment_status: string | null;
  settled_at: string | null;
}

export async function listGroupPaymentsHistory(groupId: string): Promise<PaymentHistoryRow[]> {
  const { data, error } = await supabase
    .from("group_payments_history")
    .select("*")
    .eq("group_id", groupId)
    .order("due_date", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as PaymentHistoryRow[];
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.contribution_id);
  const { data: pays } = await supabase
    .from("payments")
    .select("id, contribution_id, djomy_transaction_id, payment_method, status, settled_at")
    .in("contribution_id", ids)
    .order("settled_at", { ascending: false, nullsFirst: false });
  const byContrib = new Map<string, any>();
  for (const p of (pays ?? []) as any[]) {
    // garder le plus récent (succeeded en priorité)
    const prev = byContrib.get(p.contribution_id);
    if (!prev) byContrib.set(p.contribution_id, p);
    else if (p.status === "succeeded" && prev.status !== "succeeded") byContrib.set(p.contribution_id, p);
  }
  return rows.map((r) => {
    const p = byContrib.get(r.contribution_id);
    return {
      ...r,
      payment_id: p?.id ?? null,
      djomy_transaction_id: p?.djomy_transaction_id ?? null,
      payment_method: p?.payment_method ?? null,
      payment_status: p?.status ?? null,
      settled_at: p?.settled_at ?? r.confirmed_at,
    };
  });
}