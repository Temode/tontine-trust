import { describe, it, expect } from "vitest";
import { deepLinkToPath } from "./deepLink";

describe("deepLinkToPath", () => {
  it("ouvre l'appel", () => {
    expect(deepLinkToPath("com.tontinedigitale.app://appel/abc-123")).toBe("/appel/abc-123");
  });
  it("garde l'action refuser", () => {
    expect(deepLinkToPath("com.tontinedigitale.app://appel/abc?action=decline")).toBe("/appel/abc?action=decline");
  });
  it("ignore les autres liens", () => {
    expect(deepLinkToPath("com.tontinedigitale.app://dashboard")).toBeNull();
    expect(deepLinkToPath(null)).toBeNull();
  });
});
