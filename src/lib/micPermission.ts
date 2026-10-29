// Autorisation micro dans l'app mobile.
// Règle : une seule demande, au premier lancement après connexion, jamais
// spontanément pendant un appel entrant. Après refus, un toucher explicite
// sur Micro peut le redemander (LiveKit le demande en ouvrant le micro).

const ASKED_KEY = "td_mic_asked_v1";
const STATE_KEY = "td_mic_state_v1";

export type MicState = "granted" | "denied" | "unknown";

export function shouldPromptMic(o: {
  native: boolean;
  signedIn: boolean;
  alreadyAsked: boolean;
  path: string;
}): boolean {
  if (!o.native || !o.signedIn || o.alreadyAsked) return false;
  // Jamais pendant un appel.
  return !o.path.startsWith("/appel/");
}

/** Décrochage d'un appel entrant : sans micro déjà accordé, on rejoint
 *  micro coupé pour qu'aucune boîte système ne s'ouvre. */
export function incomingMicMuted(native: boolean, state: MicState): boolean {
  return native && state !== "granted";
}

function safeGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function safeSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ }
}

export function micAlreadyAsked(): boolean {
  return safeGet(ASKED_KEY) === "1";
}
export function markMicAsked(): void {
  safeSet(ASKED_KEY, "1");
}
export function getMicState(): MicState {
  const v = safeGet(STATE_KEY);
  return v === "granted" || v === "denied" ? v : "unknown";
}
export function setMicState(s: MicState): void {
  safeSet(STATE_KEY, s);
}

/** Ouvre la boîte système Android (via la WebView) puis libère le micro. */
export async function requestMicPermission(): Promise<MicState> {
  markMicAsked();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    setMicState("granted");
    return "granted";
  } catch {
    setMicState("denied");
    return "denied";
  }
}
