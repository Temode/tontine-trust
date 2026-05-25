import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type NotificationKind =
  | "invitation_received"
  | "invitation_accepted"
  | "cycle_started"
  | "contribution_due"
  | "contribution_received"
  | "contribution_confirmed"
  | "turn_started"
  | "turn_paid"
  | "payout_released"
  | "receipt_ready"
  | "reliability_changed"
  | "member_joined"
  | "group_completed"
  | "system";

export interface DbNotification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  group_id: string | null;
  turn_id: string | null;
  link: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export async function listMyNotifications(limit = 50): Promise<DbNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DbNotification[];
}

export async function countUnread(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markRead(id: string): Promise<void> {
  const { error } = await supabase.rpc("mark_notification_read", { _id: id });
  if (error) throw error;
}

export async function markAllRead(): Promise<number> {
  const { data, error } = await supabase.rpc("mark_all_notifications_read");
  if (error) throw error;
  return (data as number) ?? 0;
}

export function subscribeToMyNotifications(
  userId: string,
  onInsert: (n: DbNotification) => void,
): RealtimeChannel {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (payload) => onInsert(payload.new as DbNotification),
    )
    .subscribe();
  return channel;
}

export const KIND_LABEL: Record<NotificationKind, string> = {
  invitation_received: "Invitation",
  invitation_accepted: "Invitation acceptée",
  cycle_started: "Cycle démarré",
  contribution_due: "Échéance",
  contribution_received: "Cotisation reçue",
  contribution_confirmed: "Cotisation confirmée",
  turn_started: "Nouveau tour",
  turn_paid: "Tour payé",
  payout_released: "Versement",
  receipt_ready: "Reçu prêt",
  reliability_changed: "Score mis à jour",
  member_joined: "Nouveau membre",
  group_completed: "Groupe terminé",
  system: "Système",
};