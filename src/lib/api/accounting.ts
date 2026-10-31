import { supabase } from "@/integrations/supabase/client";

export type Compartment = "client_escrow" | "platform_revenue";
export type LedgerCategory =
  | "contribution"
  | "payout"
  | "sms_pack"
  | "subscription"
  | "withdrawal_fee"
  | "coordinator_fee"
  | "refund"
  | "adjustment";

export interface TreasurySummaryRow {
  compartment: Compartment;
  category: LedgerCategory;
  total_in: number;
  total_out: number;
  net: number;
  net_30d: number;
}

export interface TreasuryJournalRow {
  id: string;
  compartment: Compartment;
  category: LedgerCategory;
  direction: "in" | "out";
  amount: number;
  memo: string | null;
  created_at: string;
  user_id: string | null;
  user_name: string | null;
  group_id: string | null;
  group_name: string | null;
}

export interface WithdrawalFeeConfig {
  percent: number;
  min_fee: number;
  max_fee: number | null;
  is_active: boolean;
}

export const CATEGORY_LABEL: Record<LedgerCategory, string> = {
  contribution: "Cotisation",
  payout: "Retrait / versement",
  sms_pack: "Recharge SMS",
  subscription: "Abonnement",
  withdrawal_fee: "Frais de retrait",
  coordinator_fee: "Commission coordinateur",
  refund: "Remboursement",
  adjustment: "Ajustement",
};

export const COMPARTMENT_LABEL: Record<Compartment, string> = {
  client_escrow: "Fonds clients (séquestre)",
  platform_revenue: "Revenus Tontine Digitale",
};

export async function fetchTreasurySummary(): Promise<TreasurySummaryRow[]> {
  const { data, error } = await supabase.rpc("admin_treasury_summary" as never);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TreasurySummaryRow[];
}

export interface JournalParams {
  compartment?: Compartment;
  category?: LedgerCategory;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function fetchTreasuryJournal(
  params: JournalParams = {},
): Promise<{ rows: TreasuryJournalRow[]; total: number }> {
  const { data, error } = await supabase.rpc("admin_treasury_journal" as never, {
    _compartment: params.compartment ?? null,
    _category: params.category ?? null,
    _from: params.from ?? null,
    _to: params.to ?? null,
    _search: params.search ?? null,
    _limit: params.limit ?? 50,
    _offset: params.offset ?? 0,
  } as never);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as (TreasuryJournalRow & { total_count: number })[];
  return {
    rows: rows.map(({ total_count, ...r }) => r),
    total: Number(rows[0]?.total_count ?? 0),
  };
}

export async function fetchWithdrawalFeeConfig(): Promise<WithdrawalFeeConfig> {
  const { data, error } = await supabase
    .from("withdrawal_fee_config" as never)
    .select("percent,min_fee,max_fee,is_active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as unknown as WithdrawalFeeConfig | null;
  return {
    percent: Number(row?.percent ?? 0),
    min_fee: Number(row?.min_fee ?? 0),
    max_fee: row?.max_fee == null ? null : Number(row.max_fee),
    is_active: Boolean(row?.is_active),
  };
}

export async function updateWithdrawalFeeConfig(cfg: WithdrawalFeeConfig): Promise<void> {
  const { error } = await supabase.rpc("admin_update_withdrawal_fee_config" as never, {
    _percent: cfg.percent,
    _min_fee: cfg.min_fee,
    _max_fee: cfg.max_fee,
    _is_active: cfg.is_active,
  } as never);
  if (error) throw new Error(error.message);
}

/** Frais appliqués à un montant, selon la configuration active. */
export function computeWithdrawalFee(amount: number, cfg: WithdrawalFeeConfig): number {
  if (!cfg.is_active || !amount || amount <= 0) return 0;
  let fee = Math.floor((amount * cfg.percent) / 100);
  if (fee < cfg.min_fee) fee = cfg.min_fee;
  if (cfg.max_fee != null && fee > cfg.max_fee) fee = cfg.max_fee;
  if (fee > amount) fee = amount;
  return fee;
}
