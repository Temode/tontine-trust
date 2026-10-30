import { useLayoutEffect, useSyncExternalStore } from "react";

const owners = new Map<symbol, boolean>();
const listeners = new Set<() => void>();
let snapshot = { busy: false, full: false };
function publish() {
  const busy = owners.size > 0;
  const full = [...owners.values()].some(Boolean);
  if (busy === snapshot.busy && full === snapshot.full) return;
  snapshot = { busy, full };
  listeners.forEach((listener) => listener());
}
export function registerCallPriority(full: boolean) {
  const id = Symbol();
  owners.set(id, full);
  publish();
  return () => { owners.delete(id); publish(); };
}
export function useCallPriority() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => snapshot,
    () => snapshot,
  );
}
export function useRegisterCallPriority(busy: boolean, full: boolean) {
  useLayoutEffect(() => busy ? registerCallPriority(full) : undefined, [busy, full]);
}