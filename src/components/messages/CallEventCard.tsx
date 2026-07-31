import { useQuery } from "@tanstack/react-query";
import { Phone, PhoneOff } from "lucide-react";
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
  const { startCall } = useCall();
  const { data: status } = useQuery({
    queryKey: ["call-status", callId],
    queryFn: async () => {
      const { data } = await supabase
        .from("call_requests")
        .select("status")
        .eq("id", callId)
        .maybeSingle();
      return (data?.status as string | undefined) ?? null;
    },
    staleTime: 15_000,
  });

  const live = status === "pending" || status === "accepted";

  return (
    <div
      className={cn(
        "chat-bubble-shadow flex w-[min(20rem,80vw)] items-center gap-3 rounded-2xl px-3 py-2.5",
        mine ? "bg-chat-out text-chat-out-foreground" : "bg-chat-in text-chat-in-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          mine ? "bg-chat-out-foreground/15" : "bg-secondary",
        )}
      >
        {live ? (
          <Phone className={cn("h-4 w-4", mine ? "" : "text-primary")} />
        ) : (
          <PhoneOff className={cn("h-4 w-4", mine ? "opacity-70" : "text-muted-foreground")} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {live ? "Appel de groupe" : "Appel terminé"}
        </p>
        <p className={cn("truncate text-[12px]", mine ? "opacity-80" : "text-muted-foreground")}>
          {authorName} · {relative(createdAt)}
        </p>
      </div>
      {live && (
        <button
          type="button"
          onClick={() =>
            startCall({
              callId,
              groupId,
              groupName,
              prefs: { micMuted: false, camOff: true, screenShare: false },
            })
          }
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition",
            mine
              ? "bg-chat-out-foreground/20 hover:bg-chat-out-foreground/30"
              : "bg-primary text-primary-foreground hover:bg-primary-700",
          )}
        >
          Rejoindre
        </button>
      )}
    </div>
  );
}