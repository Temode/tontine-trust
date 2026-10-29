import { describe, expect, it } from "vitest";
import { incomingMicMuted, shouldPromptMic } from "./micPermission";

const base = { native: true, signedIn: true, alreadyAsked: false, path: "/tableau-de-bord" };

describe("autorisation micro", () => {
  it("demande au premier lancement après connexion", () => {
    expect(shouldPromptMic(base)).toBe(true);
  });
  it("ne demande qu'une seule fois", () => {
    expect(shouldPromptMic({ ...base, alreadyAsked: true })).toBe(false);
  });
  it("ne demande jamais pendant un appel", () => {
    expect(shouldPromptMic({ ...base, path: "/appel/abc" })).toBe(false);
  });
  it("ne demande pas avant connexion ni sur le web", () => {
    expect(shouldPromptMic({ ...base, signedIn: false })).toBe(false);
    expect(shouldPromptMic({ ...base, native: false })).toBe(false);
  });
  it("décroche micro coupé si le micro n'est pas accordé", () => {
    expect(incomingMicMuted(true, "denied")).toBe(true);
    expect(incomingMicMuted(true, "unknown")).toBe(true);
    expect(incomingMicMuted(true, "granted")).toBe(false);
    expect(incomingMicMuted(false, "unknown")).toBe(false);
  });
});
