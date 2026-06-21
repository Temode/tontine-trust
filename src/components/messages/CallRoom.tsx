import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Circle,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  ShieldAlert,
  Square,
  Video,
  VideoOff,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";
import { useCallTimer } from "@/hooks/useCallTimer";
import { CallParticipantTile } from "./CallParticipantTile";
import { MicPermissionGate, type PreCallDevicePrefs } from "./MicPermissionGate";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { giveCallRecordingConsent } from "@/lib/api/calls";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  callId: string | null;
  groupName?: string;
  groupId?: string;
  initialPrefs?: PreCallDevicePrefs | null;
}

export function CallRoom({ open, onOpenChange, callId, groupName, groupId, initialPrefs }: Props) {
  const { user } = useAuth();
  const [micGranted, setMicGranted] = useState(false);
  const [preCallPrefs, setPreCallPrefs] = useState<PreCallDevicePrefs>({
    micMuted: false,
    camOff: false,
    screenShare: false,
  });
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [showDiag, setShowDiag] = useState(false);
  const {
    status,
    error,
    participants,
    peers,
    isMuted,
    toggleMute,
    isCamOff,
    toggleCam,
    isScreenSharing,
    toggleScreenShare,
    leave,
    isRecording,
    turnAvailable,
    localStream,
    diagEvents,
  } = useWebRTCCall({
    callId,
    enabled: open && micGranted,
    groupId,
    recordingEnabled,
    video: true,
    initialMuted: preCallPrefs.micMuted,
    initialCamOff: preCallPrefs.camOff,
    initialScreenShare: preCallPrefs.screenShare,
  });

  const { data: call } = useQuery({
    queryKey: ["call-detail", callId],
    queryFn: async () => {
      if (!callId) return null;
      const { data } = await supabase
        .from("call_requests")
        .select("started_at, topic, recording_consent_user_ids")
        .eq("id", callId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!callId,
    refetchInterval: open ? 5000 : false,
  });

  const duration = useCallTimer(call?.started_at ?? null);

  useEffect(() => {
    if (!open || !initialPrefs || micGranted) return;
    setPreCallPrefs(initialPrefs);
    setMicGranted(true);
  }, [initialPrefs, micGranted, open]);

  const handleLeave = async () => {
    await leave();
    onOpenChange(false);
    setMicGranted(false);
    setPreCallPrefs({ micMuted: false, camOff: false, screenShare: false });
    setRecordingEnabled(false);
  };

  // Auto-close on errors with no remediation (user dismiss)
  const [showError, setShowError] = useState(false);
  useEffect(() => {
    if (status === "error") setShowError(true);
  }, [status]);

  const activeParticipants = participants.filter((p) => !p.left_at);
  const remoteParticipants = activeParticipants.filter((p) => p.user_id !== user?.id);

  // Realtime participant events → toast feed
  const prevRef = useRef<Map<string, { is_muted: boolean; left_at: string | null }>>(new Map());
  useEffect(() => {
    if (!open || status !== "live") {
      prevRef.current = new Map();
      return;
    }
    const next = new Map<string, { is_muted: boolean; left_at: string | null }>();
    participants.forEach((p) => {
      next.set(p.user_id, { is_muted: p.is_muted, left_at: p.left_at });
      const before = prevRef.current.get(p.user_id);
      const name = p.profile?.full_name ?? "Un membre";
      if (p.user_id === user?.id) return;
      if (!before) {
        if (!p.left_at) toast(`${name} a rejoint l'appel`);
      } else {
        if (before.left_at == null && p.left_at != null) toast(`${name} a quitté l'appel`);
        if (before.left_at != null && p.left_at == null) toast(`${name} a rejoint l'appel`);
        if (before.is_muted !== p.is_muted) {
          toast(p.is_muted ? `${name} est en sourdine` : `${name} a réactivé son micro`);
        }
      }
    });
    prevRef.current = next;
  }, [participants, open, status, user?.id]);

  // Recording consent
  const myConsent = useMemo(() => {
    const ids = (call?.recording_consent_user_ids as string[] | undefined) ?? [];
    return user?.id ? ids.includes(user.id) : false;
  }, [call, user?.id]);

  const consentCount = ((call?.recording_consent_user_ids as string[] | undefined) ?? []).length;
  const totalParticipants = activeParticipants.length || 1;
  const allConsented = consentCount >= totalParticipants;

  const requestRecording = async () => {
    if (!callId) return;
    if (!myConsent) {
      try {
        await giveCallRecordingConsent(callId);
        toast.success("Consentement enregistré", {
          description: allConsented
            ? "Tous les participants ont accepté — vous pouvez démarrer l'enregistrement."
            : "En attente du consentement des autres participants.",
        });
      } catch (e) {
        toast.error("Action impossible", { description: (e as Error).message });
      }
      return;
    }
    if (!allConsented) {
      toast.info("En attente des autres consentements", {
        description: `${consentCount}/${totalParticipants} membres ont accepté.`,
      });
      return;
    }
    setRecordingEnabled((v) => !v);
    toast.success(recordingEnabled ? "Enregistrement arrêté" : "Enregistrement démarré", {
      description: recordingEnabled
        ? "Le fichier sera disponible dans l'historique."
        : "Tous les participants sont informés.",
    });
  };

  // Mic permission gate
  if (open && !micGranted) {
    return (
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) onOpenChange(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="sr-only">Autorisation micro</DialogTitle>
          <MicPermissionGate
            onGranted={(prefs) => {
              setPreCallPrefs(prefs);
              setMicGranted(true);
            }}
            onCancel={() => {
              setPreCallPrefs({ micMuted: false, camOff: false, screenShare: false });
              onOpenChange(false);
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) void handleLeave();
        else onOpenChange(v);
      }}
    >
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 border-0 p-0 sm:rounded-none">
        <DialogTitle className="sr-only">Appel audio en cours</DialogTitle>

        {/* Header */}
        <header className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div>
            <p className="font-display text-sm font-semibold text-foreground">
              {groupName ?? "Appel audio"}
            </p>
            {call?.topic && (
              <p className="text-xs text-muted-foreground">{call.topic}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isRecording && (
              <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                <Circle className="h-2 w-2 animate-pulse fill-current" />
                REC
              </span>
            )}
            <span
              className={cn(
                "inline-flex h-2 w-2 rounded-full",
                status === "live" ? "animate-pulse bg-primary" : "bg-muted-foreground/40",
              )}
            />
            <span className="text-xs font-semibold text-foreground">
              {status === "live" ? "En direct" : status === "connecting" ? "Connexion…" : status === "requesting-mic" ? "Micro…" : "—"}
            </span>
            <span className="ml-3 tabular-nums text-sm font-semibold text-foreground">
              {duration}
            </span>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          {showError && error && (
            <div className="mx-auto mb-6 max-w-md rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-center text-sm text-destructive">
              {error}
            </div>
          )}
          {!turnAvailable && status === "live" && (
            <p className="mx-auto mb-4 max-w-md text-center text-[11px] text-muted-foreground">
              Mode STUN uniquement — si vous n'entendez personne, contactez votre admin pour activer TURN (Twilio).
            </p>
          )}

          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
            <CallParticipantTile
              name={user?.user_metadata?.full_name ?? "Vous"}
              initials={getInitials(user?.user_metadata?.full_name ?? "Moi") ?? "··"}
              stream={localStream}
              isLocal
              isMuted={isMuted}
              isCamOff={isCamOff}
              connectionState="connected"
            />
            {remoteParticipants.map((p) => {
              const peer = peers[p.user_id];
              return (
                <CallParticipantTile
                  key={p.user_id}
                  name={p.profile?.full_name ?? "Membre"}
                  stream={peer?.stream ?? null}
                  isMuted={p.is_muted}
                  connectionState={peer?.connectionState ?? "connecting"}
                />
              );
            })}
            {remoteParticipants.length === 0 && status === "live" && (
              <div className="col-span-2 flex h-40 items-center justify-center rounded-xl border border-dashed border-hairline text-center text-sm text-muted-foreground sm:col-span-2">
                En attente d'autres participants…
              </div>
            )}
          </div>

          {/* WebRTC diagnostic drawer */}
          {showDiag && (
            <div className="mx-auto mt-6 max-w-3xl rounded-xl border border-hairline bg-card p-4 text-xs">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-sm font-semibold text-foreground">
                  Diagnostic WebRTC
                </p>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {diagEvents.length} events
                </span>
              </div>
              {/* Per-peer summary */}
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                {Object.values(peers).map((p) => {
                  const name =
                    participants.find((pa) => pa.user_id === p.user_id)?.profile?.full_name ??
                    p.user_id.slice(0, 8);
                  return (
                    <div key={p.user_id} className="rounded-md border border-hairline p-2">
                      <p className="font-semibold text-foreground">{name}</p>
                      <p className="text-muted-foreground">
                        conn:{" "}
                        <span className="font-mono text-foreground">{p.connectionState}</span> ·
                        ice:{" "}
                        <span className="font-mono text-foreground">
                          {p.iceConnectionState ?? "—"}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        signaling:{" "}
                        <span className="font-mono text-foreground">
                          {p.signalingState ?? "—"}
                        </span>{" "}
                        · retries:{" "}
                        <span className="font-mono text-foreground">{p.retries ?? 0}</span>
                      </p>
                      {p.lastError && (
                        <p className="mt-1 text-destructive">{p.lastError}</p>
                      )}
                    </div>
                  );
                })}
                {Object.keys(peers).length === 0 && (
                  <p className="text-muted-foreground">Aucun pair connecté.</p>
                )}
              </div>
              {/* Event log */}
              <div className="max-h-48 overflow-y-auto rounded-md bg-muted/40 p-2 font-mono text-[10px] leading-relaxed">
                {diagEvents.slice(-60).map((e, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-muted-foreground">
                      {new Date(e.ts).toLocaleTimeString()}
                    </span>
                    <span className="text-primary">{e.type}</span>
                    {e.peer && (
                      <span className="text-muted-foreground">[{e.peer.slice(0, 6)}]</span>
                    )}
                    <span className="flex-1 truncate text-foreground">{e.detail ?? ""}</span>
                  </div>
                ))}
                {diagEvents.length === 0 && (
                  <p className="text-muted-foreground">Aucun événement.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob(
                    [
                      JSON.stringify(
                        {
                          callId,
                          timestamp: new Date().toISOString(),
                          status,
                          turnAvailable,
                          peers,
                          events: diagEvents,
                        },
                        null,
                        2,
                      ),
                    ],
                    { type: "application/json" },
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `webrtc-diag-${callId}-${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="mt-3 h-8 w-full rounded-md border border-hairline text-[11px] font-semibold text-foreground hover:bg-secondary"
              >
                Exporter le diagnostic (JSON)
              </button>
            </div>
          )}
        </div>

        {/* Footer / controls */}
        <footer className="flex items-center justify-center gap-4 border-t border-hairline bg-card px-6 py-5">
          <button
            type="button"
            onClick={toggleMute}
            disabled={status !== "live"}
            className={cn(
              "inline-flex h-12 w-12 items-center justify-center rounded-full border border-hairline transition hover:bg-secondary",
              isMuted && "border-destructive/40 bg-destructive/10 text-destructive",
            )}
            aria-label={isMuted ? "Réactiver le micro" : "Couper le micro"}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={toggleCam}
            disabled={status !== "live" || !localStream?.getVideoTracks().length}
            className={cn(
              "inline-flex h-12 w-12 items-center justify-center rounded-full border border-hairline transition hover:bg-secondary disabled:opacity-50",
              isCamOff && "border-destructive/40 bg-destructive/10 text-destructive",
            )}
            aria-label={isCamOff ? "Réactiver la caméra" : "Couper la caméra"}
          >
            {isCamOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              void toggleScreenShare().catch((e: Error) => {
                toast.error("Partage d'écran impossible", { description: e.message });
              });
            }}
            disabled={status !== "live"}
            className={cn(
              "inline-flex h-12 w-12 items-center justify-center rounded-full border border-hairline transition hover:bg-secondary disabled:opacity-50",
              isScreenSharing && "border-primary/40 bg-primary/10 text-primary",
            )}
            aria-label={isScreenSharing ? "Arrêter le partage d'écran" : "Partager mon écran"}
            title={isScreenSharing ? "Arrêter le partage" : "Partager mon écran"}
          >
            {isScreenSharing ? <MonitorX className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={requestRecording}
            disabled={status !== "live"}
            className={cn(
              "inline-flex h-12 items-center gap-2 rounded-full border border-hairline px-4 text-xs font-semibold transition hover:bg-secondary",
              isRecording && "border-destructive/40 bg-destructive/10 text-destructive",
            )}
            aria-label="Enregistrer l'appel"
          >
            {isRecording ? <Square className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            {isRecording
              ? "Arrêter"
              : !myConsent
                ? "Consentir à l'enreg."
                : allConsented
                  ? "Enregistrer"
                  : `Consentements ${consentCount}/${totalParticipants}`}
            {!allConsented && myConsent && <ShieldAlert className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setShowDiag((v) => !v)}
            className={cn(
              "inline-flex h-12 w-12 items-center justify-center rounded-full border border-hairline transition hover:bg-secondary",
              showDiag && "border-primary/40 bg-primary/10 text-primary",
            )}
            aria-label="Diagnostic WebRTC"
            title="Diagnostic WebRTC"
          >
            <Activity className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleLeave}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground shadow-md transition hover:opacity-90"
          >
            <PhoneOff className="h-5 w-5" />
            Quitter
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}