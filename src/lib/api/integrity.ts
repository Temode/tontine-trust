import { supabase } from "@/integrations/supabase/client";

export interface TontineAlert {
  id: string;
  group_id: string;
  turn_id: string | null;
  contribution_id: string | null;
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface TurnAssignmentAuditRow {
  group_id: string;
  group_name: string;
  cycle_id: string;
  cycle_number: number;
  turn_id: string;
  turn_number: number;
  turn_status: string;
  due_date: string;
  paid_at: string | null;
  beneficiary_user_id: string;
  beneficiary_name: string | null;
  contribution_id: string | null;
  payer_user_id: string | null;
  payer_name: string | null;
  amount: number | null;
  contribution_status: string | null;
  confirmed_at: string | null;
  flag_payer_is_beneficiary: boolean;
  flag_payer_not_active: boolean;
}

export interface CycleOpenTurnCheckRow {
  cycle_id: string;
  group_id: string;
  cycle_number: number;
  open_turns: number;
  upcoming_turns: number;
  paid_turns: number;
}

export async function listTontineAlerts(includeResolved = false): Promise<TontineAlert[]> {
  const q = supabase
    .from("tontine_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const { data, error } = includeResolved ? await q : await q.is("resolved_at", null);
  if (error) throw error;
  return (data ?? []) as TontineAlert[];
}

export async function resolveTontineAlert(id: string): Promise<void> {
  const { error } = await supabase.rpc("resolve_tontine_alert", { _alert_id: id });
  if (error) throw error;
}

export async function listTurnAssignmentAudit(groupId?: string): Promise<TurnAssignmentAuditRow[]> {
  let q = supabase
    .from("turn_assignment_audit")
    .select("*")
    .order("cycle_number", { ascending: false })
    .order("turn_number", { ascending: true })
    .limit(500);
  if (groupId) q = q.eq("group_id", groupId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TurnAssignmentAuditRow[];
}

export async function listCycleOpenTurnChecks(): Promise<CycleOpenTurnCheckRow[]> {
  const { data, error } = await supabase
    .from("cycle_open_turn_check")
    .select("*")
    .order("cycle_number", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as CycleOpenTurnCheckRow[];
}

export async function explainContribution(contributionId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc("explain_contribution", {
    _contribution_id: contributionId,
  });
  if (error) throw error;
  return (data ?? {}) as Record<string, unknown>;
}