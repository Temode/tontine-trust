import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Link2, Loader2, Phone, Video } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { listGroupMembers } from "@/lib/api/members";
import { sendGroupMessage } from "@/lib/api/chat";
import { requestGroupCall } from "@/lib/api/calls";
import { getInitials } from "@/lib/format";
import { useCall } from "@/hooks/CallContext";
import { ensureMediaPermissions, type MediaPermissionFailure } from "@/lib/media/permissions";
import { MediaPermissionPrompt } from "./MediaPermissionPrompt";

interface Props {
  groupId: string;
  groupName?: string;
  /** Bouton déclencheur (icône du header). */
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CallLauncherPopover({
  groupId,
  groupName,
  children,
  open,
  onOpenChange,
}: Props) {
  const { startCall } = useCall();
  const [view, setView] = useState<"main" | "schedule">("main");
  const [topic, setTopic] = useState("");
  const [datetime, setDatetime] = useState("");

  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [permIssue, setPermIssue] = useState<{
    reason: MediaPermissionFailure;
    message: string;
    withVideo: boolean;
  } | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: () => listGroupMembers(groupId),
    enabled: open,
    staleTime: 60_000,
  });
  const activeMembers = members.filter((m) => m.status === "active");
  const selectedMembers = activeMembers.filter((m) => !excluded.has(m.id));

  const toggleMember = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const launch = useMutation({
    mutationFn: async (video: boolean) => {
      const perm = await ensureMediaPermissions(video);
      if (perm.ok === false) {
        setPermIssue({ reason: perm.reason, message: perm.message, withVideo: video });
        return null;
      }
      const callId = await requestGroupCall(groupId, "", null);
      return { callId, video: video && perm.hasVideo, degraded: video && !perm.hasVideo };
    },
    onMutate: () => {
      // Fermeture immédiate : sensation WhatsApp, la vue d'appel prend le relais.
      onOpenChange(false);
    },
    onSuccess: (res) => {
      if (!res) return;
      const { callId, video, degraded } = res;
      if (degraded) {
        toast.info("Caméra indisponible", {
          description: "L'appel démarre en mode vocal.",
        });
      }
      startCall({
        callId,
        groupId,
        groupName,
        prefs: { micMuted: false, camOff: !video, screenShare: false },
        manageLifecycle: true,
        cancelOnCloseBeforeJoin: true,
      });
    },
    onError: (e: Error) =>
      toast.error("Appel impossible", { description: e.message }),
  });

  const sendLink = useMutation({
    mutationFn: async () => {
      const callId = await requestGroupCall(groupId, "", null);
      const url = `${window.location.origin}/appel/${callId}`;
      await sendGroupMessage(groupId, `Lien d'appel : ${url}`);
    },
    onMutate: () => {
      onOpenChange(false);
    },
    onSuccess: () => {
      toast.success("Lien d'appel envoyé dans la discussion");
    },
    onError: (e: Error) =>
      toast.error("Envoi impossible", { description: e.message }),
  });

  const schedule = useMutation({
    mutationFn: () =>
      requestGroupCall(groupId, topic, new Date(datetime).toISOString()),
    onSuccess: () => {
      setTopic("");
      setDatetime("");
      setView("main");
      onOpenChange(false);
      toast.success("Appel programmé", {
        description: "Les membres du groupe sont prévenus.",
      });
    },
    onError: (e: Error) =>
      toast.error("Planification impossible", { description: e.message }),
  });

  const busy = launch.isPending || sendLink.isPending;
  const pendingVideo = launch.isPending && launch.variables === true;
  const pendingAudio = launch.isPending && launch.variables === false;
  const noSelection = selectedMembers.length === 0;

  return (
    <Popover
      open={open}
      modal={false}
      onOpenChange={(v) => {
        if (!v) setView("main");
        onOpenChange(v);
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(20rem,calc(100vw-1.5rem))] p-0"
      >
        {view === "schedule" ? (
          <div className="space-y-3 p-3">
            <p className="font-display text-sm font-semibold text-foreground">
              Planifier un appel
            </p>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                Sujet (facultatif)
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={120}
                placeholder="Ex. Point sur la cotisation"
                className="h-10 w-full rounded-md border border-hairline bg-background px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                Date et heure
              </label>
              <input
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                className="h-10 w-full rounded-md border border-hairline bg-background px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setView("main")}
                className="h-10 flex-1 rounded-md border border-hairline text-xs font-semibold text-foreground hover:bg-secondary"
              >
                Retour
              </button>
              <button
                type="button"
                disabled={!datetime || schedule.isPending}
                onClick={() => schedule.mutate()}
                className="h-10 flex-1 rounded-md bg-primary text-xs font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-50"
              >
                {schedule.isPending ? "Envoi…" : "Programmer"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-hairline p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {getInitials(groupName ?? "") || "··"}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold text-foreground">
                  {groupName ?? "Groupe"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  Membres notifiés
                </p>
              </div>
            </div>

            <div className="max-h-[200px] overflow-y-auto px-3 py-2">
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-8 w-8 animate-pulse rounded-full bg-secondary" />
                      <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
                    </div>
                  ))}
                </div>
              ) : activeMembers.length === 0 ? (
                <p className="py-2 text-xs text-muted-foreground">
                  Aucun membre actif à appeler.
                </p>
              ) : (
                <ul className="space-y-1" data-testid="call-member-list">
                  {activeMembers.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        checked={!excluded.has(m.id)}
                        onChange={() => toggleMember(m.id)}
                        aria-label={m.profile?.full_name ?? "Membre"}
                        data-testid={`call-member-${m.id}`}
                        className="h-4 w-4 shrink-0 accent-primary"
                      />
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-foreground">
                        {getInitials(m.profile?.full_name ?? "") || "··"}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                        {m.profile?.full_name ?? "Membre"}
                      </span>
                      {m.role === "organisateur" && (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
                          Organisateur
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-hairline p-3">
              <p className="mb-2 text-[10px] text-muted-foreground" data-testid="call-selection-count">
                {selectedMembers.length} membre{selectedMembers.length > 1 ? "s" : ""} sélectionné
                {selectedMembers.length > 1 ? "s" : ""} sur {activeMembers.length}.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || noSelection}
                  data-testid="call-start-audio"
                  onClick={() => launch.mutate(false)}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary text-xs font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-50"
                >
                  {pendingAudio ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Phone className="h-4 w-4" />
                  )}
                  {pendingAudio ? "Connexion…" : "Appel vocal"}
                </button>
                <button
                  type="button"
                  disabled={busy || noSelection}
                  data-testid="call-start-video"
                  onClick={() => launch.mutate(true)}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary text-xs font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-50"
                >
                  {pendingVideo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Video className="h-4 w-4" />
                  )}
                  {pendingVideo ? "Connexion…" : "Appel vidéo"}
                </button>
              </div>

              <div className="mt-2 space-y-0.5">
                <button
                  type="button"
                  disabled={busy}
                  data-testid="call-send-link"
                  onClick={() => sendLink.mutate()}
                  className="inline-flex h-9 w-full items-center gap-2 rounded-md px-2 text-xs text-foreground transition hover:bg-secondary disabled:opacity-50"
                >
                  {sendLink.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                  )}
                  {sendLink.isPending ? "Envoi du lien…" : "Envoyer un lien d'appel dans le groupe"}
                </button>
                <button
                  type="button"
                  onClick={() => setView("schedule")}
                  className="inline-flex h-9 w-full items-center gap-2 rounded-md px-2 text-xs text-foreground transition hover:bg-secondary"
                >
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  Planifier un appel
                </button>
              </div>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}