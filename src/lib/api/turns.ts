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
      "id, group_id, cycle_id, turn_number, due_date, payout_amount, status, beneficiary_user_id, payout_hold_until",
    )
    .eq("group_id", groupId)
    .order("turn_number", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const ids = Array.from(
    new Set(rows.map((r: any) => r.beneficiary_user_id).filter(Boolean)),
  );
  const nameById = new Map<string, string | null>();
  if (ids.length > 0) {
    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    if (pErr) throw pErr;
    (profs ?? []).forEach((p: any) => nameById.set(p.id, p.full_name ?? null));
  }
  return rows.map((t: any) => ({
    group_id: t.group_id,
    turn_id: t.id,
    cycle_id: t.cycle_id,
    turn_number: t.turn_number,
    due_date: t.due_date,
    payout_amount: t.payout_amount,
    status: t.status,
    beneficiary_user_id: t.beneficiary_user_id,
    beneficiary_name: nameById.get(t.beneficiary_user_id) ?? null,
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