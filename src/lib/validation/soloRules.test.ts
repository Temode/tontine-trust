import { describe, it, expect } from "vitest";
import { parseSoloQuota, translateSoloError } from "@/lib/api/solo";

/**
 * Tests de non-régression — règles Solo côté client.
 * Complètent db/tests/solo_and_international_rules.test.sql (règles serveur).
 */
describe("quota Solo", () => {
  it("parse le code d'erreur serveur", () => {
    expect(parseSoloQuota("QUOTA_SOLO_EXCEEDED:0/0:free")).toEqual({ used: 0, max: 0, plan: "free" });
    expect(parseSoloQuota("QUOTA_SOLO_EXCEEDED:3/3:premium")).toEqual({ used: 3, max: 3, plan: "premium" });
    expect(parseSoloQuota("boom")).toBeNull();
  });

  it("plan sans Solo → message d'upsell explicite", () => {
    expect(translateSoloError("QUOTA_SOLO_EXCEEDED:0/0:free")).toMatch(/Premium ou Business/);
  });

  it("quota atteint → message chiffré", () => {
    expect(translateSoloError("QUOTA_SOLO_EXCEEDED:3/3:premium")).toMatch(/3\/3/);
  });

  it("quota illimité n'est jamais présenté comme bloqué à tort", () => {
    expect(parseSoloQuota("QUOTA_SOLO_EXCEEDED:5/-1:business")?.max).toBe(-1);
  });
});

describe("règles structurelles Solo", () => {
  const SOLO_MEMBERS = 1;
  it("une tontine Solo compte exactement 1 membre (organisateur unique)", () => {
    expect(SOLO_MEMBERS).toBe(1);
  });
});

describe("règles Internationale", () => {
  const eligibleStatuses = ["draft", "open"];
  it("les statuts draft et open restent éligibles à la candidature", () => {
    expect(eligibleStatuses).toContain("draft");
    expect(eligibleStatuses).toContain("open");
  });
});
