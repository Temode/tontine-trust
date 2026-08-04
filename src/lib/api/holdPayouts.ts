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

// ────────────────────────────────────────────────────────────────────────────
// Historique des rétentions (libérées ou en cours) pour le membre connecté
// ────────────────────────────────────────────────────────────────────────────

export interface DbHoldHistoryRow {
  turn_id: string;
  group_id: string;
  group_name: string | null;
  turn_number: number;
  payout_amount: number;
  paid_at: string | null;
  payout_hold_until: string;
  is_extended: boolean;
  is_released: boolean;
}

export async function listMyPayoutHoldHistory(): Promise<DbHoldHistoryRow[]> {
  const { data, error } = await (supabase as any).rpc("list_my_payout_hold_history");
  if (error) throw error;
  return (data ?? []) as DbHoldHistoryRow[];
}

// ────────────────────────────────────────────────────────────────────────────
// Admin : liste les tours sous rétention + historique de retard
// ────────────────────────────────────────────────────────────────────────────

export interface AdminPayoutHoldRow {
  turn_id: string;
  group_id: string;
  group_name: string | null;
  turn_number: number;
  beneficiary_user_id: string;
  beneficiary_name: string | null;
  payout_amount: number;
  paid_at: string | null;
  payout_hold_until: string;
  is_extended: boolean;
  is_released: boolean;
  was_late_in_cycle: boolean;
  was_late_at_turn_number: number[] | null;
  notif_first_sent_at: string | null;
  notif_last_sent_at: string | null;
  notif_resend_count: number;
}

export async function adminListPayoutHolds(onlyActive = false): Promise<AdminPayoutHoldRow[]> {
  const { data, error } = await (supabase as any).rpc("admin_list_payout_holds", {
    _only_active: onlyActive,
  });
  if (error) throw error;
  return (data ?? []) as AdminPayoutHoldRow[];
}

export async function adminResendPayoutHoldNotice(turnId: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("admin_resend_payout_hold_notice", {
    _turn_id: turnId,
  });
  if (error) throw error;
  return Boolean(data);
}
