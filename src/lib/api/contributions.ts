import { supabase } from "@/integrations/supabase/client";

export interface DbContributionDue {
  contribution_id: string;
  turn_id: string;
  group_id: string;
  group_name: string;
  amount: number;
  status: "pending" | "submitted" | "rejected";
  turn_number: number;
  due_date: string;
  beneficiary_user_id: string;
  beneficiary_name: string | null;
  days_to_due: number;
}

export async function listMyContributionsDue(): Promise<DbContributionDue[]> {
  const { data, error } = await supabase.from("my_contributions_due").select("*");
  if (error) throw error;
  return (data ?? []) as DbContributionDue[];
}

export async function listTurnContributions(turnId: string) {
  const { data, error } = await supabase
    .from("contributions")
    .select(
      "id, payer_user_id, amount, status, confirmed_at, profile:profiles!contributions_payer_user_id_fkey(full_name)",
    )
    .eq("turn_id", turnId);
  if (error) throw error;
  return data ?? [];
}
