type TraceValue = string | number | boolean | null;
type TraceEntry = { at: string; event: string; data: Record<string, TraceValue> };
const entries: TraceEntry[] = [];
let enabled = false;
export function callTraceEnabled() { return import.meta.env.DEV && enabled; }
export function recordCallTrace(event: string, data: Record<string, TraceValue> = {}) {
  if (!callTraceEnabled()) return;
  entries.push({ at: new Date().toISOString(), event, data });
  if (entries.length > 600) entries.shift();
}
// Session-only, no localStorage, credentials, participant identity or content.
if (import.meta.env.DEV) {
  Object.assign(window, { __callDiagnostic: {
    enable: () => { enabled = true; entries.length = 0; },
    disable: () => { enabled = false; entries.length = 0; },
    read: () => structuredClone(entries),
  } });
}