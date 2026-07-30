import { describe, expect, it } from "vitest";
import { computeWithdrawalFee, type WithdrawalFeeConfig } from "./accounting";

const cfg = (p: Partial<WithdrawalFeeConfig> = {}): WithdrawalFeeConfig => ({
  percent: 2,
  min_fee: 500,
  max_fee: 5000,
  is_active: true,
  ...p,
});

describe("computeWithdrawalFee", () => {
  it("retourne 0 quand les frais sont désactivés", () => {
    expect(computeWithdrawalFee(100000, cfg({ is_active: false }))).toBe(0);
  });
  it("applique le pourcentage", () => {
    expect(computeWithdrawalFee(100000, cfg())).toBe(2000);
  });
  it("applique le minimum", () => {
    expect(computeWithdrawalFee(1000, cfg())).toBe(500);
  });
  it("applique le maximum", () => {
    expect(computeWithdrawalFee(10000000, cfg())).toBe(5000);
  });
  it("ne dépasse jamais le montant", () => {
    expect(computeWithdrawalFee(100, cfg({ min_fee: 500, max_fee: null }))).toBe(100);
  });
  it("ignore les montants invalides", () => {
    expect(computeWithdrawalFee(0, cfg())).toBe(0);
  });
});
