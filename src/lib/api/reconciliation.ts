import { supabase } from "@/integrations/supabase/client";

export type UserWithdrawalStatusLike = "pending" | "completed" | "rejected";

export interface WithdrawalLike {
  amount: number;
  status: UserWithdrawalStatusLike;
}

export interface WalletExpectation {
  totalWithdrawn: number;
  lockedAmount: number;
  availableAmount: number;
}

/**
 * Règle unique de calcul du portefeuille consolidé :
 * - `total_withdrawn` = somme des retraits **traités** uniquement (completed / approved & paid)
 * - `locked_amount`   = somme des retraits **en attente** (gel du montant)
 * - `available`       = crédits - retraits traités - retraits en attente (jamais négatif)
 * Les retraits rejetés sont dégelés et n'impactent aucun agrégat.
 */
export function computeWalletExpectation(
  totalCredited: number,
  withdrawals: WithdrawalLike[],
): WalletExpectation {
  const sum = (s: UserWithdrawalStatusLike) =>
    withdrawals.filter((w) => w.status === s).reduce((a, w) => a + Number(w.amount || 0), 0);
  const totalWithdrawn = sum("completed");
  const lockedAmount = sum("pending");
  const availableAmount = Math.max(totalCredited - totalWithdrawn - lockedAmount, 0);
  return { totalWithdrawn, lockedAmount, availableAmount };
}

export interface ReconciliationFinding {
  id: string;
  run_id: string;
  user_id: string;
  full_name: string | null;
  code: "withdrawn_mismatch" | "available_mismatch" | "over_withdrawn" | string;
  severity: "critical" | "warning" | "info" | string;
  expected_amount: number;
  actual_amount: number;
  delta: number;
  details: Record<string, unknown>;
  resolved_at: string | null;
  created_at: string;
}

export interface ReconciliationSummary {
  open_count: number;
  critical_count: number;
  withdrawn_mismatch_count: number;
  max_abs_delta: number;
  last_run_at: string | null;
}

export const FINDING_LABEL: Record<string, string> = {
  withdrawn_mismatch: "Total retiré ≠ retraits traités",
  available_mismatch: "Solde disponible incohérent",
  over_withdrawn: "Retraits supérieurs aux crédits",
};

export async function fetchReconciliationSummary(): Promise<ReconciliationSummary> {
  const { data, error } = await supabase.rpc("admin_reconciliation_summary" as never);
  if (error) throw error;
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    open_count: Number(d.open_count ?? 0),
    critical_count: Number(d.critical_count ?? 0),
    withdrawn_mismatch_count: Number(d.withdrawn_mismatch_count ?? 0),
    max_abs_delta: Number(d.max_abs_delta ?? 0),
    last_run_at: (d.last_run_at as string) ?? null,
  };
}

export async function listReconciliationFindings(onlyOpen = true): Promise<ReconciliationFinding[]> {
  const { data, error } = await supabase.rpc("admin_list_reconciliation_findings" as never, {
    _only_open: onlyOpen,
    _limit: 200,
  } as never);
  if (error) throw error;
  return (data ?? []) as ReconciliationFinding[];
}

export async function runReconciliation(): Promise<string> {
  const { data, error } = await supabase.rpc("run_balance_reconciliation" as never, {
    _source: "manual",
  } as never);
  if (error) throw error;
  return data as string;
}

export async function resolveReconciliationFinding(id: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc("admin_resolve_reconciliation_finding" as never, {
    _id: id,
    _note: note ?? null,
  } as never);
  if (error) throw error;
}

export interface BalanceJournalEntry {
  occurred_at: string;
  kind: "ledger" | "withdrawal" | "platform" | "audit" | string;
  label: string;
  direction: "in" | "out" | "hold" | "info" | string;
  amount: number;
  reference: string | null;
  metadata: Record<string, unknown> | null;
}

export async function fetchUserBalanceJournal(userId: string): Promise<BalanceJournalEntry[]> {
  const { data, error } = await supabase.rpc("admin_user_balance_journal" as never, {
    _user_id: userId,
    _limit: 300,
  } as never);
  if (error) throw error;
  return (data ?? []) as BalanceJournalEntry[];
}

/** Solde cumulé (du plus ancien au plus récent) pour retracer chaque variation. */
export function withRunningBalance(
  entries: BalanceJournalEntry[],
): (BalanceJournalEntry & { running_balance: number })[] {
  const asc = [...entries].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  );
  let running = 0;
  const out = asc.map((e) => {
    if (e.direction === "in") running += Number(e.amount || 0);
    else if (e.direction === "out") running -= Number(e.amount || 0);
    return { ...e, running_balance: running };
  });
  return out.reverse();
}
