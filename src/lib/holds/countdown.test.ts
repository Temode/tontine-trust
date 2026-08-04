import { describe, it, expect } from "vitest";
import { computeHoldStatus, formatHoldUntilLabel } from "./countdown";

describe("computeHoldStatus", () => {
  it("released exactement à T-0 (instant UTC)", () => {
    const until = "2026-07-01T21:44:00Z";
    const now = Date.parse(until);
    const s = computeHoldStatus(until, now);
    expect(s.released).toBe(true);
    expect(s.remainingMs).toBe(0);
    expect(s.label).toBe("Débloqué");
  });

  it("released dès 1ms après T-0", () => {
    const until = "2026-07-01T21:44:00Z";
    const s = computeHoldStatus(until, Date.parse(until) + 1);
    expect(s.released).toBe(true);
  });

  it("non released 1ms avant T-0", () => {
    const until = "2026-07-01T21:44:00Z";
    const s = computeHoldStatus(until, Date.parse(until) - 1);
    expect(s.released).toBe(false);
    expect(s.remainingMs).toBe(1);
  });

  it("countdown identique quelle que soit la forme ISO (Z vs +00:00)", () => {
    const a = computeHoldStatus("2026-07-01T21:44:00Z", 0);
    const b = computeHoldStatus("2026-07-01T21:44:00+00:00", 0);
    expect(a.remainingMs).toBe(b.remainingMs);
  });

  it("countdown ne dépend pas du fuseau du navigateur (instants UTC)", () => {
    // paid_at = 2026-06-24 21:44 UTC, +7 jours => 2026-07-01 21:44 UTC.
    // Un user à Paris (UTC+2 en été) et un à Conakry (UTC) doivent voir
    // EXACTEMENT le même temps restant pour le même instant `now`.
    const until = "2026-07-01T21:44:00Z";
    const nowParis = Date.parse("2026-07-01T22:00:00+02:00"); // 20:00 UTC
    const nowConakry = Date.parse("2026-07-01T20:00:00Z");
    expect(nowParis).toBe(nowConakry);
    const a = computeHoldStatus(until, nowParis);
    const b = computeHoldStatus(until, nowConakry);
    expect(a.remainingMs).toBe(b.remainingMs);
    expect(a.parts).toEqual({ days: 0, hours: 1, minutes: 44, seconds: 0 });
  });

  it("formate en jours quand > 24h restantes", () => {
    const until = "2026-07-01T00:00:00Z";
    const now = Date.parse("2026-06-28T00:00:00Z"); // 3 jours
    const s = computeHoldStatus(until, now);
    expect(s.parts.days).toBe(3);
    expect(s.label).toBe("3j 0h 0m");
  });

  it("ISO invalide → released", () => {
    expect(computeHoldStatus("not-a-date", 0).released).toBe(true);
  });
});

describe("formatHoldUntilLabel", () => {
  it("affiche la date en heure Conakry (UTC), pas du navigateur", () => {
    // 23:30 UTC le 30/06 → encore le 30/06 à Conakry (UTC),
    // alors qu'un navigateur à Paris (UTC+2) verrait 01:30 le 01/07.
    const s = formatHoldUntilLabel("2026-06-30T23:30:00Z");
    expect(s).toMatch(/30 juin 2026/);
  });
});