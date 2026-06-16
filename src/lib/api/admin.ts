import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface PlatformKpis {
  users_total: number;
  users_new_7d: number;
  groups_active: number;
  groups_total: number;
  cycles_open: number;
  volume_30d: number;
  payment_failures_7d: number;
  deletion_requests_open: number;
  reliability_avg: number;
}

export interface AdminUserRow {
  id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  reliability_score: number;
  created_at: string;
  suspended_at: string | null;
  deleted_at: string | null;
  roles: string[] | null;
  groups_count: number;
}

export interface AdminGroupRow {
  id: string;
  name: string;
  status: string;
  contribution_amount: number;
  frequency: string;
  max_members: number;
  created_at: string;
  created_by: string;
  deleted_at: string | null;
  paused_at: string | null;
  archived_at: string | null;
  organizer_name: string | null;
  members_count: number;
  volume_total: number;
}

export interface AdminPaymentRow {
  id: string;
  group_id: string | null;
  user_id: string | null;
  amount: number;
  status: string;
  provider: string | null;
  payment_method: string | null;
  djomy_transaction_id: string | null;
  error_message: string | null;
  initiated_at: string | null;
  settled_at: string | null;
  group_name: string | null;
  payer_name: string | null;
}

export interface AuditRow {
  id: string;
  actor_user_id: string | null;
  group_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function fetchPlatformKpis(): Promise<PlatformKpis> {
  const { data, error } = await supabase
    .from("admin_platform_kpis" as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as PlatformKpis;
}

export async function listAdminUsers(search?: string): Promise<AdminUserRow[]> {
  let q = supabase
    .from("admin_user_overview" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    q = q.or(`full_name.ilike.${s},email.ilike.${s},phone_number.ilike.${s}`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AdminUserRow[];
}

export async function listAdminGroups(search?: string): Promise<AdminGroupRow[]> {
  let q = supabase
    .from("admin_group_overview" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (search && search.trim()) {
    q = q.ilike("name", `%${search.trim()}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AdminGroupRow[];
}

export async function listAdminPayments(status?: string): Promise<AdminPaymentRow[]> {
  let q = supabase
    .from("admin_payment_overview" as never)
    .select("*")
    .order("initiated_at", { ascending: false })
    .limit(200);
  if (status && status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AdminPaymentRow[];
}

export async function listAuditLog(limit = 200): Promise<AuditRow[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AuditRow[];
}

export async function adminSetUserRole(targetUserId: string, role: AppRole, grant: boolean) {
  const { error } = await supabase.rpc("admin_set_user_role" as never, {
    _target_user: targetUserId,
    _role: role,
    _grant: grant,
  } as never);
  if (error) throw new Error(error.message);
}

export async function adminSuspendUser(targetUserId: string, suspend: boolean, reason?: string) {
  const { error } = await supabase.rpc("admin_suspend_user" as never, {
    _target_user: targetUserId,
    _suspend: suspend,
    _reason: reason ?? null,
  } as never);
  if (error) throw new Error(error.message);
}

export async function adminForceGroupStatus(
  groupId: string,
  action: "pause" | "resume" | "archive",
  reason?: string,
) {
  const { error } = await supabase.rpc("admin_force_group_status" as never, {
    _group_id: groupId,
    _action: action,
    _reason: reason ?? null,
  } as never);
  if (error) throw new Error(error.message);
}