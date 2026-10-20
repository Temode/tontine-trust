import { describe, expect, it } from "vitest";
import { canUseAssistant } from "./assistantAccess";

describe("accès assistant", () => {
  it("refuse le plan gratuit", () => expect(canUseAssistant("free", "free")).toBe(false));
  it("autorise Premium actif", () => expect(canUseAssistant("premium", "active")).toBe(true));
  it("refuse Premium expiré", () => expect(canUseAssistant("premium", "past_due")).toBe(false));
  it("autorise Business en essai", () => expect(canUseAssistant("business", "trialing")).toBe(true));
});
