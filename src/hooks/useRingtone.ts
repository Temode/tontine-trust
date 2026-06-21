import { useEffect, useRef } from "react";

/**
 * Synthesise une sonnerie d'appel entrant via Web Audio API
 * (cloche feutrée, style TONTINE) — pas besoin d'asset binaire.
 * Boucle automatiquement toutes les 2.4s tant que `active` est vrai.
 */
export function useRingtone(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      stoppedRef.current = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (ctxRef.current) {
        try {
          ctxRef.current.close();
        } catch {
          /* ignore */
        }
        ctxRef.current = null;
      }
      // Vibration fallback (mobiles)
      try {
        if ("vibrate" in navigator) navigator.vibrate(0);
      } catch {
        /* ignore */
      }
      return;
    }

    stoppedRef.current = false;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    let ctx: AudioContext;
    try {
      ctx = new AudioCtx();
      ctxRef.current = ctx;
    } catch {
      return;
    }

    const playBell = (freq: number, when: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + when);
      gain.gain.setValueAtTime(0, ctx.currentTime + when);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + when + 0.04);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + when + duration,
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + duration + 0.05);
    };

    const loop = () => {
      if (stoppedRef.current || !ctxRef.current) return;
      // Cloche double : ré-fa (deux notes douces)
      playBell(587.33, 0, 0.55); // D5
      playBell(698.46, 0.18, 0.7); // F5
      playBell(587.33, 0.9, 0.55);
      playBell(698.46, 1.08, 0.7);
      try {
        if ("vibrate" in navigator) navigator.vibrate([300, 200, 300]);
      } catch {
        /* ignore */
      }
      timerRef.current = window.setTimeout(loop, 2400);
    };

    // Démarrage : si l'AudioContext est suspendu (autoplay policy),
    // on tente quand même — l'utilisateur a généralement déjà interagi.
    const start = async () => {
      try {
        if (ctx.state === "suspended") await ctx.resume();
      } catch {
        /* ignore */
      }
      loop();
    };
    void start();

    return () => {
      stoppedRef.current = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      try {
        ctx.close();
      } catch {
        /* ignore */
      }
      ctxRef.current = null;
      try {
        if ("vibrate" in navigator) navigator.vibrate(0);
      } catch {
        /* ignore */
      }
    };
  }, [active]);
}