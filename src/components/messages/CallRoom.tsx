import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Circle, Mic, MicOff, PhoneOff, ShieldAlert, Square } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";
import { useCallTimer } from "@/hooks/useCallTimer";
import { CallParticipantTile } from "./CallParticipantTile";
import { MicPermissionGate } from "./MicPermissionGate";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { giveCallRecordingConsent } from "@/lib/api/calls";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  callId: string | null;
  groupName?: string;
  groupId?: string;
}

export function CallRoom({ open, onOpenChange, callId, groupName, groupId }: Props) {
  const { user } = useAuth();
  const [micGranted, setMicGranted] = useState(false);
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const {
    status,
    error,
    participants,
    peers,
    isMuted,
    toggleMute,
    leave,
    isRecording,
    turnAvailable,
  } = useWebRTCCall({
    callId,
    enabled: open && micGranted,
    groupId,
    recordingEnabled,
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

  const handleLeave = async () => {
    await leave();
    onOpenChange(false);
    setMicGranted(false);
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
            onGranted={() => setMicGranted(true)}
            onCancel={() => onOpenChange(false)}
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
              isLocal
              isMuted={isMuted}
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