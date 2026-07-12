import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: () => ({ select: () => ({ order: async () => ({ data: [], error: null }) }) }),
    functions: { invoke: async () => ({ data: null, error: null }) },
  },
}));

import {
  getMyWallet,
  adminListWithdrawalsV2,
  requestUserWithdrawal,
  formatDestination,
} from "./wallet";

beforeEach(() => rpcMock.mockReset());

describe("wallet API", () => {
  it("getMyWallet reads first row and coerces to numbers", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ available_amount: "5000", locked_amount: "1000", total_credited: "6000", total_withdrawn: "0" }],
      error: null,
    });
    const w = await getMyWallet();
    expect(w).toEqual({ available_amount: 5000, locked_amount: 1000, total_credited: 6000, total_withdrawn: 0 });
  });

  it("adminListWithdrawalsV2 extracts total_count and strips it from rows", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        { id: "a", user_id: "u", full_name: "X", phone_number: null, amount: 1000,
          payment_method: "mobile_money_om", payment_details: {}, status: "pending",
          rejection_reason: null, processed_at: null, created_at: "now", total_count: 42 },
      ],
      error: null,
    });
    const res = await adminListWithdrawalsV2({ status: "pending", limit: 20, offset: 0 });
    expect(res.total).toBe(42);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).not.toHaveProperty("total_count");
  });

  it("requestUserWithdrawal propagates RPC errors (e.g. INSUFFICIENT_BALANCE)", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "INSUFFICIENT_BALANCE" } });
    await expect(
      requestUserWithdrawal({ amount: 999999, method: "mobile_money_om",
        details: { phone: "622", phone_confirm: "622" } }),
    ).rejects.toMatchObject({ message: "INSUFFICIENT_BALANCE" });
  });

  it("formatDestination masks card numbers", () => {
    const s = formatDestination("card", { cardholder_name: "A. Diallo", card_number: "4242424242424242" });
    expect(s).toContain("**** **** **** 4242");
    expect(s).not.toContain("4242424242424242");
  });
});