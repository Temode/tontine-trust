import { describe, it, expect, beforeEach } from "vitest";
import { captureReferralFromUrl, mapReferralError, REFERRAL_KEY } from "./referral";

describe("parrainage", () => {
  beforeEach(() => localStorage.clear());
  it("mémorise le code du lien en majuscules", () => {
    expect(captureReferralFromUrl("?ref=abc12345")).toBe("ABC12345");
    expect(localStorage.getItem(REFERRAL_KEY)).toBe("ABC12345");
  });
  it("ignore un code invalide", () => {
    expect(captureReferralFromUrl("?ref=<script>")).toBeNull();
  });
  it("refuse l'auto-parrainage", () => {
    expect(mapReferralError("self_referral")).toBe("self_referral");
  });
  it("refuse un second parrain", () => {
    expect(mapReferralError("already_referred")).toBe("already_referred");
  });
});
