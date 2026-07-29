import { useEffect, useMemo, useState } from "react";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useParticipants,
  useRoomContext,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import "@livekit/components-styles";
import {
  Loader2,
  Lock,
  LockOpen,
  MicOff,
  PhoneOff,
  ShieldAlert,
  UserMinus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { PreCallDevicePrefs } from "./MicPermissionGate";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  callId: string | null;
  groupName?: string;
  groupId?: string;
  initialPrefs?: PreCallDevicePrefs | null;
}

interface TokenResponse {
  token: string;
  wsUrl: string;
  roomName: string;
  identity: string;
  isHost: boolean;
}

export function CallRoom({ open, onOpenChange, callId, groupName, initialPrefs }: Props) {
  const { user } = useAuth();
  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const displayName = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    return (
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      user?.email ||
      "Participant"
    );
  }, [user]);

  useEffect(() => {
    if (!open || !callId) {
      setTokenData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.functions
      .invoke<TokenResponse>("livekit-token", {
        body: { callId, displayName },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.token) {
          setError(error?.message ?? "Impossible d'obtenir un accès à la salle.");
          setTokenData(null);
          // Rollback : évite les appels fantômes côté destinataires si
          // l'accès LiveKit échoue avant qu'aucun participant n'ait rejoint.
          void supabase.rpc("respond_call_request", { p_id: callId, p_status: "cancelled" }).catch(() => {});
        } else {
          setTokenData(data);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, callId, displayName]);

  const startVideo = initialPrefs ? !initialPrefs.camOff : false;
  const startAudio = initialPrefs ? !initialPrefs.micMuted : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:h-[85vh]">
        <DialogTitle className="sr-only">
          Appel {groupName ? `— ${groupName}` : ""}
        </DialogTitle>

        <header className="flex items-center justify-between border-b border-hairline bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4 text-primary" />
            {groupName ?? "Appel de groupe"}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-hairline px-3 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            <PhoneOff className="h-4 w-4" />
            Quitter
          </button>
        </header>

        <div className="relative flex-1 bg-[#0b0d10]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Connexion à la salle…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <ShieldAlert className="h-8 w-8 text-destructive" />
              <p className="max-w-sm text-sm text-foreground">{error}</p>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="mt-2 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Fermer
              </button>
            </div>
          )}
          {tokenData && !error && (
            <LiveKitRoom
              token={tokenData.token}
              serverUrl={tokenData.wsUrl}
              connect
              audio={startAudio}
              video={startVideo}
              onDisconnected={() => onOpenChange(false)}
              onError={(e) => setError(e.message)}
              className={cn("flex h-full w-full flex-col")}
              data-lk-theme="default"
            >
              <RoomAudioRenderer />
              <RoomStage callId={callId!} isHost={tokenData.isHost} groupName={groupName} />
              <div className="border-t border-hairline bg-card/95 px-2 py-2">
                <ControlBar
                  controls={{
                    microphone: true,
                    camera: true,
                    screenShare: true,
                    chat: false,
                    leave: true,
                  }}
                />
              </div>
            </LiveKitRoom>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoomStage({ callId, isHost, groupName }: { callId: string; isHost: boolean; groupName?: string }) {
  const participants = useParticipants();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [locked, setLocked] = useState(false);
  const [modOpen, setModOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Écoute des changements de métadonnée de salle pour propager l'état de verrou
  useEffect(() => {
    if (!room) return;
    const parse = (raw?: string) => {
      if (!raw) return;
      try {
        const meta = JSON.parse(raw) as { locked?: boolean };
        if (typeof meta.locked === "boolean") setLocked(meta.locked);
      } catch { /* ignore */ }
    };
    parse(room.metadata);
    const handler = (_: string | undefined) => parse(room.metadata);
    room.on(RoomEvent.RoomMetadataChanged, handler);
    return () => {
      room.off(RoomEvent.RoomMetadataChanged, handler);
    };
  }, [room]);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const remotes = participants.filter((p) => p.identity !== localParticipant?.identity);

  async function moderate(action: "lock" | "unlock" | "mute" | "kick", opts?: { targetIdentity?: string; trackSid?: string }) {
    const key = `${action}:${opts?.targetIdentity ?? ""}`;
    setBusy(key);
    try {
      const { data, error } = await supabase.functions.invoke("livekit-moderate", {
        body: { callId, action, ...opts },
      });
      if (error) throw error;
      if (action === "lock") toast.success("Salle verrouillée");
      if (action === "unlock") toast.success("Salle déverrouillée");
      if (action === "mute") toast.success("Participant coupé");
      if (action === "kick") toast.success("Participant exclu");
      return data;
    } catch (e) {
      toast.error("Action impossible", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative flex-1 overflow-hidden p-2">
      {isHost && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => moderate(locked ? "unlock" : "lock")}
            disabled={busy?.startsWith("lock") || busy?.startsWith("unlock")}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold shadow-sm backdrop-blur",
              locked
                ? "border-amber-500/50 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
                : "border-white/20 bg-black/50 text-white hover:bg-black/70",
            )}
            aria-label={locked ? "Déverrouiller la salle" : "Verrouiller la salle"}
          >
            {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
            {locked ? "Verrouillée" : "Verrouiller"}
          </button>
          <button
            type="button"
            onClick={() => setModOpen((v) => !v)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/20 bg-black/50 px-3 text-xs font-semibold text-white backdrop-blur hover:bg-black/70"
            aria-expanded={modOpen}
          >
            <Users className="h-4 w-4" />
            Modérer ({remotes.length})
          </button>
        </div>
      )}

      {isHost && modOpen && (
        <div className="absolute right-3 top-14 z-10 w-72 max-h-[60vh] overflow-y-auto rounded-md border border-hairline bg-card p-2 shadow-lg">
          <div className="mb-2 px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Participants — {groupName ?? "Salle"}
          </div>
          {remotes.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">Aucun autre participant.</div>
          )}
          {remotes.map((p) => {
            const micPub = p.getTrackPublication(Track.Source.Microphone);
            const canMute = !!micPub && !micPub.isMuted;
            return (
              <div
                key={p.identity}
                className="flex items-center justify-between gap-2 rounded px-2 py-2 hover:bg-secondary"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {p.name || p.identity}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {micPub?.isMuted ? "Micro coupé" : "Micro ouvert"}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canMute || busy === `mute:${p.identity}`}
                  onClick={() => micPub && moderate("mute", { targetIdentity: p.identity, trackSid: micPub.trackSid })}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-hairline px-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
                  title="Couper le micro"
                >
                  <MicOff className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy === `kick:${p.identity}`}
                  onClick={() => moderate("kick", { targetIdentity: p.identity })}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-destructive/40 px-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-40"
                  title="Exclure de la salle"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {locked && !isHost && (
        <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100 backdrop-blur">
          <Lock className="h-3.5 w-3.5" />
          Salle verrouillée par l'hôte
        </div>
      )}

      {participants.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-white/70">
          En attente d'autres participants…
        </div>
      ) : (
        <GridLayout tracks={tracks} className="h-full">
          <ParticipantTile />
        </GridLayout>
      )}
    </div>
  );
}