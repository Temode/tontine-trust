import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleOutgoingRingExpiry } from "./callLifecycle";

afterEach(() => vi.useRealTimers());

describe("outgoing ringing lifecycle", () => {
  function setup(expired = true, age = 0) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T16:15:00Z"));
    const expire = vi.fn().mockResolvedValue(expired);
    const onExpired = vi.fn();
    const stop = scheduleOutgoingRingExpiry({
      createdAt: new Date(Date.now() - age).toISOString(),
      expire, onExpired, onError: vi.fn(),
    });
    return { expire, onExpired, stop };
  }
  it("writes missed at 60 seconds, never earlier", async () => {
    const { expire, onExpired } = setup();
    await vi.advanceTimersByTimeAsync(59_999);
    expect(expire).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(expire).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
  it("counts from call creation, not from local room connection", async () => {
    const { expire } = setup(true, 10_000);
    await vi.advanceTimersByTimeAsync(49_999);
    expect(expire).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(expire).toHaveBeenCalledTimes(1);
  });
  it("does not close a call answered concurrently", async () => {
    const { expire, onExpired } = setup(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(expire).toHaveBeenCalledTimes(1);
    expect(onExpired).not.toHaveBeenCalled();
  });
  it("cancels expiration after hangup or session replacement", async () => {
    const { expire, stop } = setup();
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(expire).not.toHaveBeenCalled();
  });
});