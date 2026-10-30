import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, PhoneOff, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCall } from "@/hooks/CallContext";
import { cn } from "@/lib/utils";

export const CALL_LINK_RE =
  /\/appel\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export function extractCallId(body: string | null | undefined): string | null {
  if (!body) return null;
  const m = body.match(CALL_LINK_RE);
  return m ? m[1] : null;
}

interface Props {
  callId: string;
  groupId: string;
  groupName: string;
  authorName: string;
  createdAt: string;
  mine: boolean;
}

interface CallRow {
  status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function relative(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function CallEventCard({
  callId,
  groupId,
  groupName,
  authorName,
  createdAt,
  mine,
}: Props) {
  const { startCall, callId: activeCallId } = useCall();
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());

  const { data: call } = useQuery({
    queryKey: ["call-status", callId],
    queryFn: async (): Promise<CallRow | null> => {
      const { data } = await supabase
        .from("call_requests")
        .select("status, started_at, ended_at, created_at")
        .eq("id", callId)
        .maybeSingle();
      return (data as CallRow | null) ?? null;
    },
    staleTime: 10_000,
  });

  // Mise à jour temps réel de l'état de l'appel
  useEffect(() => {
    const ch = supabase
      .channel(`call-card:${callId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "call_requests", filter: `id=eq.${callId}` },
        (payload) => qc.setQueryData(["call-status", callId], payload.new as CallRow),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [callId, qc]);

  const status = call?.status ?? null;
  const live = status === "pending" || status === "accepted";
  const ringing = status === "pending";

  // Chrono qui tourne pour un appel en cours
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [live]);

  const startIso = call?.started_at ?? call?.created_at ?? createdAt;
  const durationSec = live
    ? (now - new Date(startIso).getTime()) / 1000
    : call?.ended_at
      ? (new Date(call.ended_at).getTime() - new Date(startIso).getTime()) / 1000
      : null;

  const isActiveHere = activeCallId === callId;

  const title = ringing
    ? "Appel de groupe en cours"
    : live
      ? "Appel de groupe"
      : status === "missed"
        ? "Appel manqué"
        : status === "cancelled" || status === "declined"
          ? "Appel annulé"
          : "Appel terminé";

  const subtitle = live
    ? `${authorName} · ${fmtDuration(durationSec ?? 0)}`
    : durationSec && durationSec > 1
      ? `${authorName} · ${fmtDuration(durationSec)} · ${relative(createdAt)}`
      : `${authorName} · ${relative(createdAt)}`;

  return (
    <div
      className={cn(
        "chat-bubble-shadow flex w-[min(20rem,80vw)] items-center gap-3 rounded-2xl px-3 py-2.5",
        mine ? "bg-chat-out text-chat-out-foreground" : "bg-chat-in text-chat-in-foreground",
      )}
    >
      <span
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          mine ? "bg-chat-out-foreground/15" : "bg-secondary",
        )}
      >
        {live ? (
          <Phone className={cn("h-4 w-4", mine ? "" : "text-primary")} />
        ) : (
          <PhoneOff className={cn("h-4 w-4", mine ? "opacity-70" : "text-muted-foreground")} />
        )}
        {live && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-success ring-2 ring-chat-in" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p
          className={cn(
            "truncate text-[12px] tabular-nums",
            mine ? "opacity-80" : "text-muted-foreground",
          )}
        >
          {subtitle}
        </p>
      </div>

      {live && (
        <button
          type="button"
          disabled={isActiveHere}
          onClick={() =>
            startCall({
              callId,
              groupId,
              groupName,
              prefs: { micMuted: false, camOff: true, screenShare: false },
            })
          }
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60",
            mine
              ? "bg-chat-out-foreground/20 hover:bg-chat-out-foreground/30"
              : "bg-primary text-primary-foreground hover:bg-primary-700",
          )}
        >
          <Video className="h-3.5 w-3.5" />
          {isActiveHere ? "En cours" : "Rejoindre"}
        </button>
      )}
    </div>
  );
}
