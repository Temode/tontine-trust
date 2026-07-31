import { useCallback, useEffect, useRef, useState } from "react";
import {
  GridLayout,
  ParticipantTile,
  TrackToggle,
  useTracks,
  useParticipants,
  useRoomContext,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import type { LocalParticipant, Room } from "livekit-client";
import "@livekit/components-styles";
import {
  ChevronDown,
  Lock,
  LockOpen,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  MoreVertical,
  PhoneOff,
  PictureInPicture2,
  UserMinus,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AudioOutputControl } from "@/components/messages/AudioOutputControl";

/**
 * Picture-in-Picture natif : `getVideo` fournit l'élément <video> cible.
 */
export function usePictureInPicture(getVideo: () => HTMLVideoElement | null) {
  const [active, setActive] = useState(false);
  const supported =
    typeof document !== "undefined" &&
    "pictureInPictureEnabled" in document &&
    document.pictureInPictureEnabled;

  useEffect(() => {
    const onEnter = () => setActive(true);
    const onLeave = () => setActive(false);
    document.addEventListener("enterpictureinpicture", onEnter, true);
    document.addEventListener("leavepictureinpicture", onLeave, true);
    return () => {
      document.removeEventListener("enterpictureinpicture", onEnter, true);
      document.removeEventListener("leavepictureinpicture", onLeave, true);
    };
  }, []);

  const toggle = useCallback(async () => {
    if (!supported) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setActive(false);
        return;
      }
      const video = getVideo();
      if (!video) return;
      await video.requestPictureInPicture();
      setActive(true);
    } catch {
      /* ignore */
    }
  }, [getVideo, supported]);

  return { supported, active, toggle };
}

export function CallStage({
  callId,
  isHost,
  groupName,
  onMinimize,
  onHangup,
  onTogglePip,
  pipSupported,
  pipActive,
}: {
  callId: string;
  isHost: boolean;
  groupName?: string;
  onMinimize: () => void;
  onHangup: () => void;
  onTogglePip: () => void;
  pipSupported: boolean;
  pipActive: boolean;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  const [locked, setLocked] = useState(false);
  const [modOpen, setModOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Écoute des changements de métadonnée pour l'état de verrou
  useEffect(() => {
    if (!room) return;
    const parse = (raw?: string) => {
      if (!raw) return;
      try {
        const meta = JSON.parse(raw) as { locked?: boolean };
        if (typeof meta.locked === "boolean") setLocked(meta.locked);
      } catch {
        /* ignore */
      }
    };
    parse(room.metadata);
    const handler = () => parse(room.metadata);
    room.on(RoomEvent.RoomMetadataChanged, handler);
    return () => {
      room.off(RoomEvent.RoomMetadataChanged, handler);
    };
  }, [room]);

  const cameraTracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const screenTrack = cameraTracks.find(
    (t) => t.source === Track.Source.ScreenShare && t.publication,
  );
  const gridTracks = cameraTracks.filter((t) => t.source === Track.Source.Camera);

  const remotes = participants.filter((p) => p.identity !== localParticipant?.identity);

  async function moderate(
    action: "lock" | "unlock" | "mute" | "kick",
    opts?: { targetIdentity?: string; trackSid?: string },
  ) {
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
      toast.error("Action impossible", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* Header discret */}
      <CallHeader
        groupName={groupName}
        participantsCount={participants.length}
        onMinimize={onMinimize}
        onTogglePip={onTogglePip}
        pipSupported={pipSupported}
        pipActive={pipActive}
        isHost={isHost}
        locked={locked}
        onToggleLock={() => moderate(locked ? "unlock" : "lock")}
        onOpenModerate={() => setModOpen((v) => !v)}
        remotesCount={remotes.length}
        busy={busy}
      />

      {/* Verrou pour non-hôte */}
      {locked && !isHost && (
        <div className="absolute left-3 top-16 z-10 inline-flex items-center gap-2 rounded-full border border-accent/50 bg-accent/20 px-3 py-1.5 text-xs font-semibold text-accent backdrop-blur">
          <Lock className="h-3.5 w-3.5" />
          Salle verrouillée par l'hôte
        </div>
      )}

      {/* Stage */}
      <div className="relative flex-1 overflow-hidden">
        {participants.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-white/70">
            En attente d'autres participants…
          </div>
        ) : screenTrack ? (
          <FocusStage
            screenTrack={screenTrack}
            gridTracks={gridTracks}
            participants={participants}
            localIdentity={localParticipant?.identity}
          />
        ) : (
          <div className="h-full p-2">
            <GridLayout tracks={gridTracks} className="h-full">
              <ParticipantTile className="!rounded-xl" />
            </GridLayout>
          </div>
        )}

        {/* Panneau modération */}
        {isHost && modOpen && (
          <div className="absolute right-3 top-16 z-20 w-[min(18rem,calc(100vw-1.5rem))] max-h-[60vh] overflow-y-auto rounded-xl border border-white/10 bg-[#141618]/95 p-2 shadow-elegant backdrop-blur">
            <div className="mb-2 px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-white/60">
              Participants — {groupName ?? "Salle"}
            </div>
            {remotes.length === 0 && (
              <div className="p-3 text-xs text-white/60">Aucun autre participant.</div>
            )}
            {remotes.map((p) => {
              const micPub = p.getTrackPublication(Track.Source.Microphone);
              const canMute = !!micPub && !micPub.isMuted;
              return (
                <div
                  key={p.identity}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">
                      {p.name || p.identity}
                    </div>
                    <div className="text-[11px] text-white/60">
                      {micPub?.isMuted ? "Micro coupé" : "Micro ouvert"}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!canMute || busy === `mute:${p.identity}`}
                    onClick={() =>
                      micPub &&
                      moderate("mute", { targetIdentity: p.identity, trackSid: micPub.trackSid })
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white hover:bg-white/10 disabled:opacity-40"
                    title="Couper le micro"
                  >
                    <MicOff className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={busy === `kick:${p.identity}`}
                    onClick={() => moderate("kick", { targetIdentity: p.identity })}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                    title="Exclure de la salle"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dock flottant */}
      <ControlDock onLeave={onHangup} onMinimize={onMinimize} />
    </div>
  );
}

function CallHeader({
  groupName,
  participantsCount,
  onMinimize,
  onTogglePip,
  pipSupported,
  pipActive,
  isHost,
  locked,
  onToggleLock,
  onOpenModerate,
  remotesCount,
  busy,
}: {
  groupName?: string;
  participantsCount: number;
  onMinimize: () => void;
  onTogglePip: () => void;
  pipSupported: boolean;
  pipActive: boolean;
  isHost: boolean;
  locked: boolean;
  onToggleLock: () => void;
  onOpenModerate: () => void;
  remotesCount: number;
  busy: string | null;
}) {
  return (
    <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 border-b border-white/10 bg-black/40 px-3 py-2 backdrop-blur">
      <button
        type="button"
        onClick={onMinimize}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
        aria-label="Réduire l'appel"
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white">
          <Users className="h-3.5 w-3.5" />
          {participantsCount}
        </span>
        {groupName && (
          <span className="hidden truncate text-xs text-white/70 sm:inline">{groupName}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {pipSupported && (
          <button
            type="button"
            onClick={onTogglePip}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10",
              pipActive && "bg-primary/80",
            )}
            aria-label="Picture-in-Picture"
          >
            <PictureInPicture2 className="h-4 w-4" />
          </button>
        )}
        <AudioOutputControl variant="full" />
        {isHost && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
                aria-label="Options d'hôte"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Actions d'hôte</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onToggleLock}
                disabled={busy?.startsWith("lock") || busy?.startsWith("unlock")}
              >
                {locked ? (
                  <>
                    <LockOpen className="mr-2 h-4 w-4" />
                    Déverrouiller la salle
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Verrouiller la salle
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenModerate}>
                <Users className="mr-2 h-4 w-4" />
                Modérer ({remotesCount})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}

function FocusStage({
  screenTrack,
  gridTracks,
  participants,
  localIdentity,
}: {
  screenTrack: ReturnType<typeof useTracks>[number];
  gridTracks: ReturnType<typeof useTracks>;
  participants: ReturnType<typeof useParticipants>;
  localIdentity?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    const onFs = () => setIsFull(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = async () => {
    if (!wrapRef.current) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wrapRef.current.requestFullscreen();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex h-full flex-col pt-14">
      <div
        ref={wrapRef}
        className="relative mx-2 mt-1 flex-1 overflow-hidden rounded-xl bg-black"
        style={{ flexBasis: "68%" }}
      >
        <ParticipantTile
          trackRef={screenTrack}
          className="!h-full !w-full !rounded-xl [&_video]:!object-contain"
        />
        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
          aria-label={isFull ? "Quitter le plein écran" : "Plein écran"}
        >
          {isFull ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Bandeau participants */}
      <div className="mt-2 px-2 pb-24">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {gridTracks.map((t, i) => {
            const p = participants.find(
              (pp) => pp.identity === t.participant.identity,
            );
            const isLocal = p?.identity === localIdentity;
            const speaking = p?.isSpeaking;
            const micMuted = p?.getTrackPublication(Track.Source.Microphone)?.isMuted;
            return (
              <div
                key={`${t.participant.identity}-${i}`}
                className={cn(
                  "relative h-24 w-24 flex-none overflow-hidden rounded-2xl bg-[#141618] ring-1 ring-white/10 transition-all",
                  speaking && "ring-2 ring-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.4)]",
                )}
              >
                <ParticipantTile
                  trackRef={t}
                  className="!h-full !w-full !rounded-2xl [&_video]:!object-cover"
                />
                <div className="pointer-events-none absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 rounded-md bg-black/50 px-1.5 py-0.5">
                  <span className="truncate text-[10px] font-medium text-white">
                    {isLocal ? "Vous" : p?.name || p?.identity}
                  </span>
                  {micMuted ? (
                    <MicOff className="h-3 w-3 text-destructive" />
                  ) : (
                    <Mic className="h-3 w-3 text-white/80" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ControlDock({
  onLeave,
  onMinimize,
}: {
  onLeave: () => void;
  onMinimize: () => void;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [confirming, setConfirming] = useState(false);

  const handleLeave = async () => {
    try {
      await room.disconnect();
    } catch {
      /* ignore */
    }
    onLeave();
  };

  const others = participants.filter(
    (p) => p.identity !== localParticipant?.identity,
  ).length;

  // La confirmation retombe d'elle-même après 4 s
  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  const onHangupClick = () => {
    if (others > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    void handleLeave();
  };

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
    >
      <div className="pointer-events-auto relative mx-2 flex max-w-[calc(100vw-1rem)] flex-wrap items-center justify-center gap-1.5 rounded-3xl border border-white/10 bg-black/70 px-2 py-2 shadow-elegant backdrop-blur-lg sm:gap-2 sm:rounded-full sm:px-3">
        {confirming && (
          <div className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/85 px-3 py-1.5 text-xs font-medium text-white shadow-elegant">
            Quitter l'appel ? Touchez à nouveau
          </div>
        )}
        <TrackToggle
          source={Track.Source.Microphone}
          className="!inline-flex !h-10 !w-10 !items-center !justify-center !gap-0 !rounded-full !bg-white/10 !px-0 !text-white hover:!bg-white/20 data-[lk-enabled=false]:!bg-destructive/80 sm:!h-11 sm:!w-11"
          showIcon={false}
        >
          {(localParticipant as LocalParticipant | undefined)?.isMicrophoneEnabled ? (
            <Mic className="h-4 w-4" />
          ) : (
            <MicOff className="h-4 w-4" />
          )}
        </TrackToggle>
        <TrackToggle
          source={Track.Source.Camera}
          className="!inline-flex !h-10 !w-10 !items-center !justify-center !gap-0 !rounded-full !bg-white/10 !px-0 !text-white hover:!bg-white/20 data-[lk-enabled=false]:!bg-destructive/80 sm:!h-11 sm:!w-11"
          showIcon={false}
        >
          {(localParticipant as LocalParticipant | undefined)?.isCameraEnabled ? (
            <Video className="h-4 w-4" />
          ) : (
            <VideoOff className="h-4 w-4" />
          )}
        </TrackToggle>
        <TrackToggle
          source={Track.Source.ScreenShare}
          className="!hidden !h-10 !w-10 !items-center !justify-center !gap-0 !rounded-full !bg-white/10 !px-0 !text-white hover:!bg-white/20 data-[lk-enabled=true]:!bg-primary/80 sm:!inline-flex sm:!h-11 sm:!w-11"
          showIcon={false}
        >
          <MonitorUp className="h-4 w-4" />
        </TrackToggle>
        <button
          type="button"
          onClick={onMinimize}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:h-11 sm:w-11"
          aria-label="Réduire l'appel"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onHangupClick}
          className={cn(
            "inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-destructive px-0 text-destructive-foreground shadow-lg transition hover:opacity-90 sm:ml-1 sm:h-11",
            confirming ? "w-auto px-4 text-xs font-semibold" : "w-10 sm:w-11",
          )}
          aria-label={confirming ? "Confirmer et raccrocher" : "Raccrocher"}
        >
          <PhoneOff className="h-4 w-4" />
          {confirming && <span>Confirmer</span>}
        </button>
      </div>
    </div>
  );
}
