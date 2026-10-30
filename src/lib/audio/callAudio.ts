// Singleton AudioContext partagé pour la sonnerie d'appel entrant.
// Déverrouillé au 1er geste utilisateur (autoplay policy Chrome/Firefox).

type Ctor = typeof AudioContext;
let ctx: AudioContext | null = null;
let unlocked = false;
const listeners = new Set<(state: AudioContextState | "missing") => void>();

function getCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext ||
    null
  );
}

export function getCallAudioContext(): AudioContext | null {
  if (ctx) return ctx;
  const C = getCtor();
  if (!C) return null;
  try {
    ctx = new C();
  } catch {
    return null;
  }
  return ctx;
}

export function getCallAudioState(): AudioContextState | "missing" {
  if (!ctx) return "missing";
  return ctx.state;
}

export function onCallAudioStateChange(cb: (s: AudioContextState | "missing") => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  for (const l of listeners) l(getCallAudioState());
}

export async function unlockCallAudio(): Promise<boolean> {
  const c = getCallAudioContext();
  if (!c) return false;
  try {
    if (c.state === "suspended") await c.resume();
    // "ping" silencieux pour bien sceller le déverrouillage iOS/Safari
    const osc = c.createOscillator();
    const gain = c.createGain();
    gain.gain.value = 0.00001;
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.01);
    unlocked = c.state === "running";
  } catch {
    unlocked = false;
  }
  emit();
  return unlocked;
}

export function isCallAudioUnlocked(): boolean {
  return unlocked && ctx?.state === "running";
}

/** Installe des listeners "first gesture" pour déverrouiller automatiquement. */
export function installCallAudioAutoUnlock() {
  if (typeof window === "undefined") return () => {};
  if (unlocked) return () => {};
  const handler = () => {
    void unlockCallAudio();
  };
  const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchend"];
  for (const e of events) window.addEventListener(e, handler, { once: true, passive: true });
  return () => {
    for (const e of events) window.removeEventListener(e, handler);
  };
}