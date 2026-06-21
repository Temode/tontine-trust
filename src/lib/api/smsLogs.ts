import { supabase } from "@/integrations/supabase/client";

export interface SmsLog {
  id: string;
  created_at: string;
  user_id: string | null;
  group_id: string | null;
  turn_id: string | null;
  recipient: string;
  recipient_normalized: string | null;
  body: string;
  kind: string;
  status: "pending" | "sent" | "failed" | "skipped";
  provider: string;
  provider_message_id: string | null;
  provider_cost: number | null;
  error: string | null;
  triggered_by: string | null;
}

export interface SmsLogsFilters {
  status?: SmsLog["status"] | "all";
  kind?: string | "all";
  search?: string;
  limit?: number;
}

export async function listSmsLogs(filters: SmsLogsFilters = {}): Promise<SmsLog[]> {
  let q = supabase
    .from("sms_logs")
    .select(
      "id, created_at, user_id, group_id, turn_id, recipient, recipient_normalized, body, kind, status, provider, provider_message_id, provider_cost, error, triggered_by",
    )
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);

  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.kind && filters.kind !== "all") q = q.eq("kind", filters.kind);
  if (filters.search && filters.search.trim().length > 0) {
    const s = filters.search.trim();
    q = q.or(`recipient.ilike.%${s}%,recipient_normalized.ilike.%${s}%,body.ilike.%${s}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SmsLog[];
}