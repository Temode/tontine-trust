import { useEffect, useState } from "react";
import { ArrowLeft, Clock, Info, Phone, Video } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getInitials } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DbGroupOverview } from "@/lib/api/types";
import { getGroupPresence, subscribePresence, type PresenceStatus } from "@/lib/api/presence";
import { listCallRequests, subscribeCallRequests } from "@/lib/api/calls";
import { CallRequestDialog } from "./CallRequestDialog";
import { CallHistoryDrawer } from "./CallHistoryDrawer";
import { PresenceDot } from "./PresenceDot";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  group: DbGroupOverview;
}

function summarizePresence(states: PresenceStatus[]): PresenceStatus | "offline" {
  if (states.some((s) => s === "available")) return "available";
  if (states.some((s) => s === "busy")) return "busy";
  if (states.some((s) => s === "dnd")) return "dnd";
  return "offline";
}

export function ConversationHeader({ group }: Props) {
  const qc = useQueryClient();
  const [callOpen, setCallOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: presence = [] } = useQuery({
    queryKey: ["group-presence", group.id],
    queryFn: () => getGroupPresence(group.id),
    staleTime: 30_000,
  });
  const { data: calls = [] } = useQuery({
    queryKey: ["call-requests", group.id],
    queryFn: () => listCallRequests(group.id),
    staleTime: 30_000,
  });

  useEffect(() => {
    const ch1 = subscribePresence(group.id, () => {
      qc.invalidateQueries({ queryKey: ["group-presence", group.id] });
    });
    const ch2 = subscribeCallRequests(group.id, () => {
      qc.invalidateQueries({ queryKey: ["call-requests", group.id] });
    });
    return () => {
      ch1.unsubscribe();
      ch2.unsubscribe();
    };
  }, [group.id, qc]);

  const presenceSummary = summarizePresence(presence.map((p) => p.status));
  const pendingCalls = calls.filter((c) => c.status === "pending").length;
  const initials = getInitials(group.name) || "··";
  const statusLabel =
    group.status === "active"
      ? "Cycle actif"
      : group.status === "paused"
      ? "En pause"
      : group.status === "draft"
      ? "Brouillon"
      : "Cycle clôturé";

  return (
    <>
    <header className="flex items-center gap-3 border-b border-hairline bg-card px-4 py-3">
      <Link
        to="/discussions"
        className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
        aria-label="Retour"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {initials}
        <span className="absolute -bottom-0.5 -right-0.5">
          <PresenceDot status={presenceSummary} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-semibold text-foreground">
          {group.name}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {group.members_count} membre{group.members_count > 1 ? "s" : ""} · {statusLabel}
          {pendingCalls > 0 && (
            <>
              {" · "}
              <span className="font-semibold text-accent-foreground">
                {pendingCalls} appel{pendingCalls > 1 ? "s" : ""} en attente
              </span>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setCallOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground transition hover:bg-secondary"
              aria-label="Demander un appel"
            >
              <Phone className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Demander un appel</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground transition hover:bg-secondary"
              aria-label="Historique des appels"
            >
              <Clock className="h-4 w-4" />
              {pendingCalls > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold tabular-nums text-accent-foreground">
                  {pendingCalls}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>Historique des appels</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setCallOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground transition hover:bg-secondary"
              aria-label="Lancer un appel vidéo"
            >
              <Video className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Lancer un appel vidéo</TooltipContent>
        </Tooltip>
        <Link
          to={`/groupes/${group.id}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Détails du groupe"
        >
          <Info className="h-4 w-4" />
        </Link>
      </div>
    </header>
    <CallRequestDialog
      open={callOpen}
      onOpenChange={setCallOpen}
      groupId={group.id}
      groupName={group.name}
    />
    <CallHistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} groupId={group.id} />
    </>
  );
}