import { useEffect, useRef } from "react";
import { getCallAudioContext, unlockCallAudio } from "@/lib/audio/callAudio";
import { toast } from "sonner";

/**
 * Synthesise une sonnerie d'appel entrant via Web Audio API
 * (cloche feutrée, style TONTINE) — pas besoin d'asset binaire.
 * Boucle automatiquement toutes les 2.4s tant que `active` est vrai.
 */
export function useRingtone(active: boolean) {
  const timerRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      stoppedRef.current = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      // Vibration fallback (mobiles)
      try {
        if ("vibrate" in navigator) navigator.vibrate(0);
      } catch {
        /* ignore */
      }
      return;
    }

    stoppedRef.current = false;

    const ctx = getCallAudioContext();
    if (!ctx) return;

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
      if (stoppedRef.current) return;
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

    const start = async () => {
      try {
        if (ctx.state === "suspended") await ctx.resume();
      } catch {
        /* ignore */
      }
      if (ctx.state !== "running") {
        // Autoplay bloqué : invite à activer le son d'un clic.
        toast("🔔 Son d'appel bloqué", {
          description: "Cliquez pour activer la sonnerie.",
          duration: 10_000,
          action: {
            label: "Activer",
            onClick: () => {
              void unlockCallAudio().then(() => {
                if (!stoppedRef.current) loop();
              });
            },
          },
        });
        // On lance quand même la vibration & le titre, et on retentera
        // au prochain cycle si jamais l'utilisateur clique.
      }
      loop();
    };
    void start();

    return () => {
      stoppedRef.current = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      try {
        if ("vibrate" in navigator) navigator.vibrate(0);
      } catch {
        /* ignore */
      }
    };
  }, [active]);
}