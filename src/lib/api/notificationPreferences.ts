import { supabase } from "@/integrations/supabase/client";
import type { NotificationKind } from "./notifications";

export type NotificationChannel = "in_app" | "email" | "sms";

export interface NotificationPreference {
  notif_type: NotificationKind;
  channel: NotificationChannel;
  enabled: boolean;
}

export async function listMyNotificationPreferences(): Promise<NotificationPreference[]> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("notif_type, channel, enabled")
    .order("notif_type");
  if (error) throw error;
  return (data ?? []) as NotificationPreference[];
}

export async function updateNotificationPreferences(
  prefs: NotificationPreference[],
): Promise<number> {
  const { data, error } = await supabase.rpc("update_notification_preferences", {
    _payload: prefs as never,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

export const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  in_app: "Application",
  email: "Email",
  sms: "SMS",
};

export const CHANNEL_HINT: Record<NotificationChannel, string> = {
  in_app: "Centre de notifications dans l'app.",
  email: "Email envoyé à votre adresse vérifiée.",
  sms: "SMS — disponible après activation des paiements mobiles.",
};