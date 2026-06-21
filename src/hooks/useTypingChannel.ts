import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TypingUser {
  user_id: string;
  name: string;
  at: number;
}

const TYPING_TTL_MS = 4000;

export function useTypingChannel(groupId: string, myUserId: string | null, myName: string) {
  const [typers, setTypers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (!groupId) return;
    const ch = supabase.channel(`typing:${groupId}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "typing" }, (payload) => {
      const p = payload.payload as TypingUser;
      if (!p?.user_id || p.user_id === myUserId) return;
      setTypers((prev) => {
        const others = prev.filter((u) => u.user_id !== p.user_id);
        return [...others, { ...p, at: Date.now() }];
      });
    });
    ch.subscribe();
    channelRef.current = ch;
    const interval = window.setInterval(() => {
      setTypers((prev) => prev.filter((u) => Date.now() - u.at < TYPING_TTL_MS));
    }, 1500);
    return () => {
      window.clearInterval(interval);
      ch.unsubscribe();
      channelRef.current = null;
    };
  }, [groupId, myUserId]);

  const notifyTyping = () => {
    if (!myUserId) return;
    const now = Date.now();
    if (now - lastSentRef.current < 1500) return;
    lastSentRef.current = now;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: myUserId, name: myName, at: now },
    });
  };

  return { typers, notifyTyping };
}