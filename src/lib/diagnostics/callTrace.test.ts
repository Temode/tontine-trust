import { afterEach, describe, expect, it, vi } from "vitest";
import { callTraceEnabled, recordCallTrace } from "./callTrace";
const control = (window as unknown as { __callDiagnostic: { enable: () => void; disable: () => void; read: () => unknown[] } }).__callDiagnostic;
afterEach(() => { vi.unstubAllEnvs(); control.disable(); });
describe("call diagnostics are opt-in and never active in production", () => {
  it("does not record until explicitly enabled", () => {
    control.disable();
    recordCallTrace("connected");
    expect(control.read()).toHaveLength(0);
    control.enable();
    recordCallTrace("connected");
    expect(control.read()).toHaveLength(1);
  });
  it("records nothing in production even if switched on", () => {
    vi.stubEnv("DEV", false);
    control.enable();
    recordCallTrace("connected");
    expect(callTraceEnabled()).toBe(false);
    expect(control.read()).toHaveLength(0);
  });
});