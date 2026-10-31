import { useEffect, useState } from "react";
import { ArrowLeft, Clock, Info, MoreVertical, Phone, Video } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getInitials } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DbGroupOverview } from "@/lib/api/types";
import { getGroupPresence, subscribePresence, type PresenceStatus } from "@/lib/api/presence";
import { listCallRequests, subscribeCallRequests } from "@/lib/api/calls";
import { listGroupMembers } from "@/lib/api/members";
import { CallHistoryDrawer } from "./CallHistoryDrawer";
import { CallLauncherPopover } from "./CallLauncherPopover";
import { PinnedCallBanner } from "./PinnedCallBanner";
import { useCall } from "@/hooks/CallContext";
import { requestGroupCall } from "@/lib/api/calls";
import { toast } from "sonner";
import { PresenceDot } from "./PresenceDot";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [callOpen, setCallOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { startCall } = useCall();
  const [videoBusy, setVideoBusy] = useState(false);

  const startVideoCall = async () => {
    if (videoBusy) return;
    setVideoBusy(true);
    try {
      const callId = await requestGroupCall(group.id, "", null);
      startCall({
        callId,
        groupId: group.id,
        groupName: group.name,
        prefs: { micMuted: false, camOff: false, screenShare: false },
        manageLifecycle: true,
        cancelOnCloseBeforeJoin: true,
      });
    } catch (e) {
      toast.error("Appel impossible", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setVideoBusy(false);
    }
  };

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
  const { data: members = [] } = useQuery({
    queryKey: ["group-members-lite", group.id],
    queryFn: () => listGroupMembers(group.id),
    staleTime: 120_000,
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

  const names = members
    .filter((m) => m.status === "active")
    .map((m) =>
      m.user_id === user?.id
        ? "Vous"
        : (m.profile?.full_name?.trim().split(" ")[0] || "Membre"),
    );
  const ordered = [...names.filter((n) => n !== "Vous"), ...names.filter((n) => n === "Vous")];
  const participants =
    ordered.length > 0
      ? ordered.slice(0, 4).join(", ") + (ordered.length > 4 ? `, +${ordered.length - 4}` : "")
      : `${group.members_count} membre${group.members_count > 1 ? "s" : ""}`;

  return (
    <>
    <header className="flex items-center gap-3 border-b border-hairline bg-card px-4 py-2.5">
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
        <p className="truncate font-display text-[15px] font-semibold text-foreground">
          {group.name}
        </p>
        <p className="truncate text-[12.5px] text-muted-foreground">{participants}</p>
      </div>
      <span className="hidden shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline">
        {statusLabel}
      </span>
      <div className="flex items-center gap-1">
        <CallLauncherPopover
          groupId={group.id}
          groupName={group.name}
          open={callOpen}
          onOpenChange={setCallOpen}
        >
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground transition hover:bg-secondary"
            aria-label="Démarrer un appel"
          >
            <Phone className="h-4 w-4" />
          </button>
        </CallLauncherPopover>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => void startVideoCall()}
              disabled={videoBusy}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground transition hover:bg-secondary"
              aria-label="Lancer un appel vidéo"
            >
              <Video className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Lancer un appel vidéo</TooltipContent>
        </Tooltip>
        <span aria-hidden className="mx-1 h-6 w-px bg-border" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground transition hover:bg-secondary"
              aria-label="Plus d'options"
            >
              <MoreVertical className="h-4 w-4" />
              {pendingCalls > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
              <Clock className="mr-2 h-4 w-4" />
              Historique des appels
              {pendingCalls > 0 && (
                <span className="ml-auto rounded-full bg-accent px-1.5 text-[10px] font-bold tabular-nums text-accent-foreground">
                  {pendingCalls}
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`/groupes/${group.id}`)}>
              <Info className="mr-2 h-4 w-4" />
              Détails de la tontine
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    <PinnedCallBanner groupId={group.id} groupName={group.name} />
    <CallHistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} groupId={group.id} />
    </>
  );
}