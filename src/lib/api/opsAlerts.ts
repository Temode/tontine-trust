import { supabase } from "@/integrations/supabase/client";

export interface OpsAlert {
  id: string;
  code: string;
  severity: "info" | "warning" | "critical" | string;
  message: string;
  context: Record<string, unknown>;
  email_status: string;
  sms_status: string;
  webhook_status: string;
  webhook_error: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface OpsRecipient {
  id: string;
  channel: "email" | "sms" | "webhook" | string;
  target: string;
  enabled: boolean;
  created_at: string;
}

export interface WithdrawalBlock {
  id: string;
  user_id: string;
  full_name: string | null;
  reason: string;
  finding_id: string | null;
  created_at: string;
  released_at: string | null;
  release_note: string | null;
}

export async function listOpsAlerts(onlyOpen = true): Promise<OpsAlert[]> {
  const { data, error } = await supabase.rpc("admin_list_ops_alerts" as never, {
    _only_open: onlyOpen,
    _limit: 200,
  } as never);
  if (error) throw error;
  return (data ?? []) as OpsAlert[];
}

export async function ackOpsAlert(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_ack_ops_alert" as never, { _id: id } as never);
  if (error) throw error;
}

export async function listOpsRecipients(): Promise<OpsRecipient[]> {
  const { data, error } = await supabase.rpc("admin_list_ops_recipients" as never);
  if (error) throw error;
  return (data ?? []) as OpsRecipient[];
}

export async function upsertOpsRecipient(
  channel: OpsRecipient["channel"],
  target: string,
  enabled = true,
): Promise<void> {
  const { error } = await supabase.rpc("admin_upsert_ops_recipient" as never, {
    _channel: channel,
    _target: target,
    _enabled: enabled,
  } as never);
  if (error) throw error;
}

export async function deleteOpsRecipient(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_ops_recipient" as never, { _id: id } as never);
  if (error) throw error;
}

export async function listWithdrawalBlocks(onlyOpen = true): Promise<WithdrawalBlock[]> {
  const { data, error } = await supabase.rpc("admin_list_withdrawal_blocks" as never, {
    _only_open: onlyOpen,
  } as never);
  if (error) throw error;
  return (data ?? []) as WithdrawalBlock[];
}

export async function releaseWithdrawalBlock(id: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc("admin_release_withdrawal_block" as never, {
    _id: id,
    _note: note ?? null,
  } as never);
  if (error) throw error;
}

/** Blocage actif de l'utilisateur courant (null si aucun). */
export async function fetchMyWithdrawalBlock(): Promise<{
  id: string;
  reason: string;
  created_at: string;
} | null> {
  const { data, error } = await supabase.rpc("my_withdrawal_block" as never);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; reason: string; created_at: string }[];
  return rows[0] ?? null;
}
