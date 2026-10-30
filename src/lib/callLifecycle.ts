/** An outgoing room connection does not mean somebody has answered. */
export const CALL_RING_TIMEOUT_MS = 60_000;

export function scheduleOutgoingRingExpiry(options: {
  createdAt: string;
  expire: () => Promise<boolean>;
  onExpired: () => void;
  onError: (error: unknown) => void;
}): () => void {
  let cancelled = false;
  const deadline = Date.parse(options.createdAt) + CALL_RING_TIMEOUT_MS;
  const timer = window.setTimeout(() => {
    void options.expire().then((expired) => {
      if (!cancelled && expired) options.onExpired();
    }).catch(options.onError);
  }, Math.max(0, deadline - Date.now()));
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}