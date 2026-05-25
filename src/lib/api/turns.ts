import { supabase } from "@/integrations/supabase/client";
import type { DbNextTurn } from "./types";

export async function getNextTurnForGroup(groupId: string): Promise<DbNextTurn | null> {
  const { data, error } = await supabase
    .from("next_turn_per_group")
    .select("*")
    .eq("group_id", groupId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as DbNextTurn | null;
}

export async function listGroupTurns(groupId: string): Promise<DbNextTurn[]> {
  const { data, error } = await supabase
    .from("turns")
    .select(
      "id, group_id, cycle_id, turn_number, due_date, payout_amount, status, beneficiary_user_id, beneficiary:profiles!turns_beneficiary_user_id_fkey(full_name)",
    )
    .eq("group_id", groupId)
    .order("turn_number", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    group_id: t.group_id,
    turn_id: t.id,
    cycle_id: t.cycle_id,
    turn_number: t.turn_number,
    due_date: t.due_date,
    payout_amount: t.payout_amount,
    status: t.status,
    beneficiary_user_id: t.beneficiary_user_id,
    beneficiary_name: t.beneficiary?.full_name ?? null,
  })) as DbNextTurn[];
}

export async function listMyNextTurns(): Promise<DbNextTurn[]> {
  const { data, error } = await supabase
    .from("next_turn_per_group")
    .select("*")
    .order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbNextTurn[];
}