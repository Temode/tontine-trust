import { useEffect, useRef } from "react";
import { Mic, MicOff, MonitorUp, VideoOff, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";

interface Props {
  name: string;
  initials?: string;
  stream?: MediaStream | null;
  isLocal?: boolean;
  isMuted?: boolean;
  isCamOff?: boolean;
  connectionState?: RTCPeerConnectionState;
  speaking?: boolean;
  isScreenSharing?: boolean;
}

export function CallParticipantTile({
  name,
  initials,
  stream,
  isLocal,
  isMuted,
  isCamOff,
  connectionState = "connected",
  speaking,
  isScreenSharing,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasVideo = !!stream && stream.getVideoTracks().some((t) => t.enabled);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    if (stream && audioRef.current && !isLocal) {
      audioRef.current.srcObject = stream;
    }
  }, [stream, isLocal]);

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
          muted={isLocal}
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

      {/* Always sink remote audio so even camera-off peers are heard. */}
      {!isLocal && stream && (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
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