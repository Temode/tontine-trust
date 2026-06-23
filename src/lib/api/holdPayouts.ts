import { supabase } from "@/integrations/supabase/client";

export interface DbHeldPayout {
  id: string;
  group_id: string;
  group_name: string | null;
  turn_number: number;
  payout_amount: number;
  paid_at: string;
  payout_hold_until: string;
  was_late_in_cycle: boolean;
}

/** Renvoie les payouts du membre connecté encore sous rétention. */
export async function listMyHeldPayouts(): Promise<DbHeldPayout[]> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("AUTH_REQUIRED");

  const { data, error } = await supabase
    .from("turns")
    .select(
      `id, group_id, turn_number, payout_amount, paid_at, payout_hold_until, groups(name), beneficiary_user_id`
    )
    .eq("beneficiary_user_id", uid)
    .eq("status", "paid")
    .gt("payout_hold_until", new Date().toISOString())
    .order("paid_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as any[];
  return rows.map((r) => ({
    id: r.id,
    group_id: r.group_id,
    group_name: r.groups?.name ?? null,
    turn_number: r.turn_number,
    payout_amount: r.payout_amount,
    paid_at: r.paid_at,
    payout_hold_until: r.payout_hold_until,
    was_late_in_cycle: true, // on sait que c'est le cas puisque payout_hold_until > standard
  }));
}
