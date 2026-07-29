import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, MonitorUp, VideoOff, Volume2, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";

interface Props {
  name: string;
  initials?: string;
  stream?: MediaStream | null;
  peerId?: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isCamOff?: boolean;
  connectionState?: RTCPeerConnectionState;
  speaking?: boolean;
  isScreenSharing?: boolean;
  onAudioEvent?: (peerId: string, detail: string) => void;
}

export function CallParticipantTile({
  name,
  initials,
  stream,
  peerId,
  isLocal,
  isMuted,
  isCamOff,
  connectionState = "connected",
  speaking,
  isScreenSharing,
  onAudioEvent,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const hasVideo = !!stream && stream.getVideoTracks().some((t) => t.enabled);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null;
    }
    if (audioRef.current && !isLocal) {
      audioRef.current.srcObject = stream ?? null;
      // Force play — autoplay peut être bloqué même si le geste initial a
      // déverrouillé l'AudioContext ; on capture le blocage pour proposer un
      // bouton "Activer le son" à l'utilisateur.
      const el = audioRef.current;
      const attemptPlay = () => {
        el.play()
          .then(() => {
            setAudioBlocked(false);
            if (peerId) onAudioEvent?.(peerId, "audio play ok");
          })
          .catch((err: DOMException) => {
            setAudioBlocked(true);
            if (peerId) onAudioEvent?.(peerId, `audio play blocked: ${err.name}`);
          });
      };
      attemptPlay();
      if (!stream) return;
      // Rejouer si une piste audio arrive plus tard (SDP renegotiation, mute distant levé).
      const onAdd = () => {
        el.srcObject = stream;
        attemptPlay();
      };
      stream.addEventListener("addtrack", onAdd);
      stream.addEventListener("removetrack", onAdd);
      return () => {
        stream.removeEventListener("addtrack", onAdd);
        stream.removeEventListener("removetrack", onAdd);
      };
    }
  }, [stream, isLocal, onAudioEvent, peerId]);

  const unblockAudio = () => {
    const el = audioRef.current;
    if (!el) return;
    el.play()
      .then(() => {
        setAudioBlocked(false);
        if (peerId) onAudioEvent?.(peerId, "audio play ok (manual)");
      })
      .catch((err: DOMException) => {
        setAudioBlocked(true);
        if (peerId) onAudioEvent?.(peerId, `audio play blocked manual: ${err.name}`);
      });
  };

  const ini = initials ?? getInitials(name) ?? "··";
  const bad =
    connectionState === "failed" ||
    connectionState === "disconnected" ||
    connectionState === "closed";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-hairline bg-black/90 shadow-sm",
        "aspect-video w-full",
        speaking && "ring-2 ring-accent/70",
      )}
    >
      {/* Video / placeholder */}
      {hasVideo && !isCamOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn("h-full w-full object-cover", isLocal && "scale-x-[-1]")}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-primary-900/90 text-primary-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-foreground/10 font-display text-xl font-bold">
            {ini}
          </div>
          {(isCamOff || !hasVideo) && (
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary-foreground/60">
              <VideoOff className="h-3 w-3" />
              Caméra coupée
            </span>
          )}
        </div>
      )}

      {/* Sink audio dédié pour tout pair distant — monté en permanence pour
          éviter les remounts qui perdent le srcObject à l'arrivée tardive
          d'une piste audio. La balise <video> est toujours mutée. */}
      {!isLocal && (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      )}

      {!isLocal && audioBlocked && (
        <button
          type="button"
          onClick={unblockAudio}
          className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground shadow-md"
        >
          <Volume2 className="h-3 w-3" />
          Activer le son
        </button>
      )}

      {/* Overlay : name + status */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/75 via-black/30 to-transparent p-3 text-primary-foreground">
        <div className="min-w-0">
          <p className="line-clamp-1 text-sm font-semibold">
            {name}
            {isLocal && <span className="ml-1 text-xs text-primary-foreground/60">(moi)</span>}
            {isScreenSharing && (
              <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-primary/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                <MonitorUp className="h-2.5 w-2.5" />
                Écran
              </span>
            )}
          </p>
          <p className="flex items-center gap-1 text-[10px] text-primary-foreground/70">
            {bad ? (
              <>
                <WifiOff className="h-3 w-3" /> Connexion instable
              </>
            ) : (
              <>
                <Wifi className="h-3 w-3" />
                {connectionState === "connected" ? "Connecté" : "Connexion…"}
              </>
            )}
          </p>
        </div>
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full border border-white/15 backdrop-blur",
            isMuted ? "bg-destructive/80" : "bg-black/40",
          )}
        >
          {isMuted ? (
            <MicOff className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
        </span>
      </div>
    </div>
  );
}