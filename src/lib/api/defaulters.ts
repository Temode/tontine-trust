import { supabase } from "@/integrations/supabase/client";

export interface DefaultReportAuditEntry {
  id: string;
  action: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface GroupDefaulterRow {
  contribution_id: string;
  group_id: string;
  turn_id: string;
  payer_user_id: string;
  payer_name: string | null;
  amount: number;
  defaulted_at: string | null;
  default_days: number;
  turn_number: number;
  due_date: string;
  has_open_report: boolean;
}

export interface DefaulterReport {
  id: string;
  group_id: string;
  reported_user_id: string;
  reported_by: string;
  contribution_id: string | null;
  reason: string | null;
  status: "open" | "in_review" | "resolved" | "legal_action" | "dismissed";
  tontine_handler_id: string | null;
  internal_notes: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface DefaulterReportEnriched extends DefaulterReport {
  group_name: string | null;
  reported_user_name: string | null;
  reported_user_phone: string | null;
  reported_by_name: string | null;
  contribution_amount: number | null;
  default_days: number | null;
  turn_number: number | null;
  due_date: string | null;
  kyc_status: string | null;
}

export async function listGroupDefaulters(groupId: string): Promise<GroupDefaulterRow[]> {
  const { data, error } = await supabase
    .from("group_defaulters")
    .select("*")
    .eq("group_id", groupId)
    .order("default_days", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GroupDefaulterRow[];
}

export async function listAllDefaulterReports(): Promise<DefaulterReportEnriched[]> {
  const { data, error } = await supabase
    .from("member_default_reports")
    .select(
      `*,
       group:groups!member_default_reports_group_id_fkey(name),
       reported_user:profiles!member_default_reports_reported_user_id_fkey(full_name, phone_number, kyc_status),
       reported_by_profile:profiles!member_default_reports_reported_by_fkey(full_name),
       contribution:contributions!member_default_reports_contribution_id_fkey(amount, default_days, turn_id, turn:turns!contributions_turn_id_fkey(turn_number, due_date))
      `,
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    id: r.id,
    group_id: r.group_id,
    reported_user_id: r.reported_user_id,
    reported_by: r.reported_by,
    contribution_id: r.contribution_id,
    reason: r.reason,
    status: r.status,
    tontine_handler_id: r.tontine_handler_id,
    internal_notes: r.internal_notes,
    resolution_note: r.resolution_note,
    created_at: r.created_at,
    updated_at: r.updated_at,
    resolved_at: r.resolved_at,
    group_name: r.group?.name ?? null,
    reported_user_name: r.reported_user?.full_name ?? null,
    reported_user_phone: r.reported_user?.phone_number ?? null,
    kyc_status: r.reported_user?.kyc_status ?? "none",
    reported_by_name: r.reported_by_profile?.full_name ?? null,
    contribution_amount: r.contribution?.amount ?? null,
    default_days: r.contribution?.default_days ?? null,
    turn_number: r.contribution?.turn?.turn_number ?? null,
    due_date: r.contribution?.turn?.due_date ?? null,
  }));
}

export async function reportDefaulter(contributionId: string, reason: string) {
  const { data, error } = await supabase.rpc("report_defaulter", {
    _contribution_id: contributionId,
    _reason: reason || null,
  });
  if (error) throw error;
  return data as string;
}

export async function updateDefaulterReport(args: {
  reportId: string;
  status?: DefaulterReport["status"];
  internalNotes?: string;
  resolutionNote?: string;
}) {
  const { error } = await supabase.rpc("update_defaulter_report", {
    _report_id: args.reportId,
    _status: args.status ?? null,
    _internal_notes: args.internalNotes ?? null,
    _resolution_note: args.resolutionNote ?? null,
  });
  if (error) throw error;
}

export async function canUserReportDefaulter(groupId: string, userId: string) {
  const { data, error } = await supabase
    .from("group_admin_permissions")
    .select("can_report_defaulter")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return false;
  return !!data?.can_report_defaulter;
}

export async function getDefaultReportAudit(reportId: string): Promise<DefaultReportAuditEntry[]> {
  const { data, error } = await supabase.rpc("get_default_report_audit", { _report_id: reportId });
  if (error) throw error;
  return (data ?? []) as DefaultReportAuditEntry[];
}

export async function addReportInternalNote(reportId: string, note: string) {
  const { error } = await supabase.rpc("update_defaulter_report", {
    _report_id: reportId,
    _status: null,
    _internal_notes: note,
    _resolution_note: null,
    _note_only: true,
  });
  if (error) throw error;
}