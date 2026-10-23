import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ActivityKind = "typing" | "recording";

export interface TypingUser {
  user_id: string;
  name: string;
  kind: ActivityKind;
  at: number;
}

/** Un pair est considéré inactif au-delà de ce délai sans nouveau signal. */
const TYPING_TTL_MS = 5000;
/** Délai local sans frappe avant d'émettre l'arrêt d'activité. */
const IDLE_STOP_MS = 3000;

export function useTypingChannel(groupId: string, myUserId: string | null, myName: string) {
  const [typers, setTypers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSentRef = useRef(0);
  const lastKindRef = useRef<ActivityKind | null>(null);
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!groupId) return;
    const ch = supabase.channel(`typing:${groupId}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "typing" }, (payload) => {
      const p = payload.payload as Partial<TypingUser>;
      if (!p?.user_id || p.user_id === myUserId) return;
      setTypers((prev) => {
        const others = prev.filter((u) => u.user_id !== p.user_id);
        return [
          ...others,
          {
            user_id: p.user_id!,
            name: p.name ?? "Membre",
            kind: p.kind === "recording" ? "recording" : "typing",
            at: Date.now(),
          },
        ];
      });
    });
    ch.on("broadcast", { event: "typing_stop" }, (payload) => {
      const p = payload.payload as { user_id?: string };
      if (!p?.user_id) return;
      setTypers((prev) => prev.filter((u) => u.user_id !== p.user_id));
    });
    ch.subscribe();
    channelRef.current = ch;
    const interval = window.setInterval(() => {
      setTypers((prev) => {
        const next = prev.filter((u) => Date.now() - u.at < TYPING_TTL_MS);
        return next.length === prev.length ? prev : next;
      });
    }, 1000);
    return () => {
      window.clearInterval(interval);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      ch.unsubscribe();
      channelRef.current = null;
    };
  }, [groupId, myUserId]);

  const stopActivity = () => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (!myUserId || lastKindRef.current === null) return;
    lastKindRef.current = null;
    lastSentRef.current = 0;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing_stop",
      payload: { user_id: myUserId },
    });
  };

  const notifyActivity = (kind: ActivityKind = "typing") => {
    if (!myUserId) return;
    const now = Date.now();
    // Toute nouvelle activité repousse l'expiration automatique.
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(stopActivity, IDLE_STOP_MS);
    // On laisse toujours passer un changement de nature d'activité (saisie ↔ vocal).
    if (kind === lastKindRef.current && now - lastSentRef.current < 1500) return;
    lastSentRef.current = now;
    lastKindRef.current = kind;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: myUserId, name: myName, kind, at: now },
    });
  };

  return {
    typers,
    notifyActivity,
    stopActivity,
    notifyTyping: () => notifyActivity("typing"),
    notifyRecording: () => notifyActivity("recording"),
  };
}
