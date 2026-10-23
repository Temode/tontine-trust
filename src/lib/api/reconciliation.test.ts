import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

import {
  computeWalletExpectation,
  withRunningBalance,
  fetchReconciliationSummary,
  listReconciliationFindings,
  type BalanceJournalEntry,
} from "./reconciliation";

beforeEach(() => rpcMock.mockReset());

describe("computeWalletExpectation — statuts de retrait", () => {
  it("aucun retrait : tout est disponible", () => {
    expect(computeWalletExpectation(50_000, [])).toEqual({
      totalWithdrawn: 0,
      lockedAmount: 0,
      availableAmount: 50_000,
    });
  });

  it("retrait en attente : gelé, pas compté dans total_withdrawn", () => {
    expect(computeWalletExpectation(50_000, [{ amount: 15_000, status: "pending" }])).toEqual({
      totalWithdrawn: 0,
      lockedAmount: 15_000,
      availableAmount: 35_000,
    });
  });

  it("retrait traité (completed/paid) : compté une seule fois", () => {
    expect(computeWalletExpectation(50_000, [{ amount: 15_000, status: "completed" }])).toEqual({
      totalWithdrawn: 15_000,
      lockedAmount: 0,
      availableAmount: 35_000,
    });
  });

  it("retrait rejeté : dégelé et neutre", () => {
    expect(computeWalletExpectation(50_000, [{ amount: 15_000, status: "rejected" }])).toEqual({
      totalWithdrawn: 0,
      lockedAmount: 0,
      availableAmount: 50_000,
    });
  });

  it("scénario mixte : 1 traité + 1 en attente + 1 rejeté", () => {
    expect(
      computeWalletExpectation(50_000, [
        { amount: 15_000, status: "completed" },
        { amount: 10_000, status: "pending" },
        { amount: 20_000, status: "rejected" },
      ]),
    ).toEqual({ totalWithdrawn: 15_000, lockedAmount: 10_000, availableAmount: 25_000 });
  });

  it("ne double-compte jamais un retrait traité (régression triple comptage)", () => {
    const w = computeWalletExpectation(30_000, [{ amount: 15_000, status: "completed" }]);
    expect(w.totalWithdrawn).toBe(15_000);
    expect(w.availableAmount).toBe(15_000);
  });

  it("solde disponible jamais négatif", () => {
    expect(
      computeWalletExpectation(10_000, [
        { amount: 8_000, status: "completed" },
        { amount: 9_000, status: "pending" },
      ]).availableAmount,
    ).toBe(0);
  });
});

describe("withRunningBalance", () => {
  it("calcule un cumul chronologique et renvoie du plus récent au plus ancien", () => {
    const entries: BalanceJournalEntry[] = [
      { occurred_at: "2026-01-02T00:00:00Z", kind: "withdrawal", label: "withdrawal_completed", direction: "out", amount: 5_000, reference: "b", metadata: null },
      { occurred_at: "2026-01-01T00:00:00Z", kind: "ledger", label: "payout_out", direction: "in", amount: 20_000, reference: "a", metadata: null },
    ];
    const rows = withRunningBalance(entries);
    expect(rows[0].running_balance).toBe(15_000);
    expect(rows[1].running_balance).toBe(20_000);
  });
});

describe("API réconciliation", () => {
  it("fetchReconciliationSummary coerce les nombres", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { open_count: "2", critical_count: "1", withdrawn_mismatch_count: "1", max_abs_delta: "29900", last_run_at: "2026-07-30T00:00:00Z" },
      error: null,
    });
    const s = await fetchReconciliationSummary();
    expect(s.open_count).toBe(2);
    expect(s.max_abs_delta).toBe(29_900);
  });

  it("listReconciliationFindings remonte l'erreur RPC", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error("FORBIDDEN") });
    await expect(listReconciliationFindings()).rejects.toThrow("FORBIDDEN");
  });
});
