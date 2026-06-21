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
  group?: { id: string; name: string } | null;
  profile?: { id: string; full_name: string | null } | null;
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
      "id, created_at, user_id, group_id, turn_id, recipient, recipient_normalized, body, kind, status, provider, provider_message_id, provider_cost, error, triggered_by, group:groups(id, name)",
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
  const rows = (data ?? []) as SmsLog[];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    for (const r of rows) {
      if (r.user_id) r.profile = map.get(r.user_id) ?? null;
    }
  }
  return rows;
}