import { useEffect, useRef, useState } from "react";

export interface AudioAuditStats {
  autoplay: "allowed" | "blocked" | "unknown";
  micPermission: "granted" | "denied" | "prompt" | "unknown";
  outputDevices: number;
  inputDevices: number;
  sampleRate: number | null;
  contextState: AudioContextState | null;
  micLevel: number | null; // 0..1 RMS instantané
  micPeak: number | null;
  lastError: string | null;
  collectedAt: number | null;
}

const initial: AudioAuditStats = {
  autoplay: "unknown",
  micPermission: "unknown",
  outputDevices: 0,
  inputDevices: 0,
  sampleRate: null,
  contextState: null,
  micLevel: null,
  micPeak: null,
  lastError: null,
  collectedAt: null,
};

export function useAudioAudit(active: boolean): AudioAuditStats {
  const [stats, setStats] = useState<AudioAuditStats>(initial);
  const peakRef = useRef(0);

  useEffect(() => {
    if (!active) {
      peakRef.current = 0;
      setStats(initial);
      return;
    }

    let cancelled = false;
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;

    const safeSet = (patch: Partial<AudioAuditStats>) => {
      if (cancelled) return;
      setStats((s) => ({ ...s, ...patch, collectedAt: Date.now() }));
    };

    const run = async () => {
      // 1) Périphériques
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devs = await navigator.mediaDevices.enumerateDevices();
          if (cancelled) return;
          safeSet({
            inputDevices: devs.filter((d) => d.kind === "audioinput").length,
            outputDevices: devs.filter((d) => d.kind === "audiooutput").length,
          });
        }
      } catch {
        /* ignore */
      }

      // 2) Permission micro
      try {
        const perms = (navigator as unknown as { permissions?: Permissions })
          .permissions;
        if (perms?.query) {
          const p = await perms.query({
            name: "microphone" as PermissionName,
          });
          if (!cancelled) safeSet({ micPermission: p.state as never });
        }
      } catch {
        /* ignore */
      }

      // 3) AudioContext + autoplay
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) {
          safeSet({ autoplay: "unknown", lastError: "AudioContext indisponible" });
          return;
        }
        ctx = new Ctor();
        safeSet({
          contextState: ctx.state,
          sampleRate: ctx.sampleRate,
          autoplay: ctx.state === "running" ? "allowed" : "blocked",
        });
        if (ctx.state === "suspended") {
          try {
            await ctx.resume();
            const newState = ctx.state as AudioContextState;
            safeSet({
              contextState: newState,
              autoplay: newState === "running" ? "allowed" : "blocked",
            });
          } catch {
            safeSet({ autoplay: "blocked" });
          }
        }
      } catch (e) {
        safeSet({ lastError: (e as Error).message });
      }

      // 4) Niveau micro (si permission accordée)
      try {
        if (!ctx) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        safeSet({ micPermission: "granted" });
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        const tick = () => {
          if (cancelled || !ctx) return;
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          peakRef.current = Math.max(peakRef.current * 0.95, rms);
          safeSet({ micLevel: rms, micPeak: peakRef.current });
          rafId = window.requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        const err = e as DOMException;
        if (err?.name === "NotAllowedError") {
          safeSet({ micPermission: "denied" });
        } else {
          safeSet({ lastError: err?.message ?? String(e) });
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (ctx) {
        try {
          void ctx.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, [active]);

  return stats;
}