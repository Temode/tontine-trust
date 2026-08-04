import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  installCallAudioAutoUnlock,
  unlockCallAudio,
  isCallAudioUnlocked,
} from "@/lib/audio/callAudio";

/**
 * Prépare la couche "appel entrant" dès que l'utilisateur est connecté :
 *  - amorce la permission Notification (1 seule fois)
 *  - déverrouille l'AudioContext au 1er geste pour que la sonnerie joue
 *    instantanément quand un appel arrive (autoplay policy).
 */
export function usePrimeCallChannel(): {
  notificationPermission: NotificationPermission | "unsupported";
  audioUnlocked: boolean;
  primeNow: () => Promise<void>;
} {
  const { user } = useAuth();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(() => isCallAudioUnlocked());

  useEffect(() => {
    if (!user?.id) return;
    // Auto-unlock au 1er geste
    const cleanup = installCallAudioAutoUnlock();
    const t = window.setInterval(() => {
      setAudioUnlocked(isCallAudioUnlocked());
    }, 1000);
    return () => {
      cleanup();
      window.clearInterval(t);
    };
  }, [user?.id]);

  const primeNow = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        if (Notification.permission === "default") {
          const p = await Notification.requestPermission();
          setPerm(p);
        } else {
          setPerm(Notification.permission);
        }
      } catch {
        /* ignore */
      }
    }
    const ok = await unlockCallAudio();
    setAudioUnlocked(ok);
  };

  return { notificationPermission: perm, audioUnlocked, primeNow };
}