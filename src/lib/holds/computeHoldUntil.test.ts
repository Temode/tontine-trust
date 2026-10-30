import { describe, it, expect } from "vitest";
import {
  computeHoldUntil,
  DEFAULT_HOLD_CONFIG,
  type Frequency,
} from "./computeHoldUntil";

const FREQS: Frequency[] = ["quotidienne", "hebdomadaire", "quinzaine", "mensuelle"];
const DAY = 86_400_000;

describe("compute_hold_until — cas unitaires par fréquence", () => {
  const paidAt = new Date("2026-06-23T12:00:00Z");

  for (const freq of FREQS) {
    const cfg = DEFAULT_HOLD_CONFIG[freq];

    it(`${freq} sans retard → +${cfg.standard_days} j`, () => {
      const got = computeHoldUntil({ frequency: freq, paid_at: paidAt, was_late_in_cycle: false });
      expect(got.getTime() - paidAt.getTime()).toBe(cfg.standard_days * DAY);
    });

    it(`${freq} avec retard → +${cfg.standard_days + cfg.penalty_extra_days} j`, () => {
      const got = computeHoldUntil({ frequency: freq, paid_at: paidAt, was_late_in_cycle: true });
      expect(got.getTime() - paidAt.getTime()).toBe(
        (cfg.standard_days + cfg.penalty_extra_days) * DAY,
      );
    });
  }

  it("paid_at NULL → fallback sur now", () => {
    const now = new Date("2026-07-01T00:00:00Z");
    const got = computeHoldUntil({
      frequency: "hebdomadaire",
      paid_at: null,
      was_late_in_cycle: false,
      now,
    });
    expect(got.getTime() - now.getTime()).toBe(7 * DAY);
  });

  it("frontière de date — payé à 23:59:59 UTC, libération +7 j même heure", () => {
    const paid = new Date("2026-06-30T23:59:59Z");
    const got = computeHoldUntil({
      frequency: "hebdomadaire",
      paid_at: paid,
      was_late_in_cycle: false,
    });
    expect(got.toISOString()).toBe("2026-07-07T23:59:59.000Z");
  });

  it("pureté : appels successifs donnent le même résultat (retards multiples)", () => {
    const args = { frequency: "mensuelle" as const, paid_at: paidAt, was_late_in_cycle: true };
    const a = computeHoldUntil(args);
    const b = computeHoldUntil(args);
    const c = computeHoldUntil(args);
    expect(a.getTime()).toBe(b.getTime());
    expect(b.getTime()).toBe(c.getTime());
  });
});

describe("compute_hold_until — propriétés (random 200 cas, PRNG déterministe)", () => {
  function rand(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x1_0000_0000;
    };
  }

  it("monotonie : avec retard ≥ sans retard, sur toutes fréquences", () => {
    const rng = rand(42);
    for (let i = 0; i < 200; i++) {
      const freq = FREQS[Math.floor(rng() * FREQS.length)];
      const paid = new Date(Date.UTC(2025, 0, 1) + Math.floor(rng() * 365 * DAY));
      const a = computeHoldUntil({ frequency: freq, paid_at: paid, was_late_in_cycle: false });
      const b = computeHoldUntil({ frequency: freq, paid_at: paid, was_late_in_cycle: true });
      expect(b.getTime()).toBeGreaterThanOrEqual(a.getTime());
    }
  });

  it("invariance temporelle : décaler paid_at de X jours décale la libération de X jours", () => {
    const rng = rand(7);
    for (let i = 0; i < 200; i++) {
      const freq = FREQS[Math.floor(rng() * FREQS.length)];
      const late = rng() > 0.5;
      const paid = new Date(Date.UTC(2026, 5, 23));
      const shiftDays = Math.floor(rng() * 365);
      const shifted = new Date(paid.getTime() + shiftDays * DAY);
      const a = computeHoldUntil({ frequency: freq, paid_at: paid, was_late_in_cycle: late });
      const b = computeHoldUntil({ frequency: freq, paid_at: shifted, was_late_in_cycle: late });
      expect(b.getTime() - a.getTime()).toBe(shiftDays * DAY);
    }
  });

  it("borne supérieure : libération ≤ paid_at + (std+penalty) j", () => {
    const rng = rand(2026);
    for (let i = 0; i < 200; i++) {
      const freq = FREQS[Math.floor(rng() * FREQS.length)];
      const cfg = DEFAULT_HOLD_CONFIG[freq];
      const paid = new Date(Date.UTC(2026, 5, 23));
      const got = computeHoldUntil({ frequency: freq, paid_at: paid, was_late_in_cycle: true });
      expect(got.getTime()).toBeLessThanOrEqual(
        paid.getTime() + (cfg.standard_days + cfg.penalty_extra_days) * DAY,
      );
    }
  });
});