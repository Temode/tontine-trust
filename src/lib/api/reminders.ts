import { supabase } from "@/integrations/supabase/client";

export type ReminderChannel = "in_app" | "sms" | "whatsapp" | "email";

export async function sendManualReminder(
  memberId: string,
  channel: ReminderChannel,
  message?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("send_manual_reminder", {
    _member_id: memberId,
    _channel: channel,
    _message: message ?? null,
  });
  if (error) throw error;
  return data as string;
}