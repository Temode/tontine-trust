import { useEffect, useRef } from "react";
import { Mic, MicOff, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";

interface Props {
  name: string;
  initials?: string;
  stream?: MediaStream | null;
  isLocal?: boolean;
  isMuted?: boolean;
  connectionState?: RTCPeerConnectionState;
  speaking?: boolean;
}

export function CallParticipantTile({
  name,
  initials,
  stream,
  isLocal,
  isMuted,
  connectionState = "connected",
  speaking,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current && stream && !isLocal) {
      audioRef.current.srcObject = stream;
    }
  }, [stream, isLocal]);

  const ini = initials ?? getInitials(name) ?? "··";
  const bad =
    connectionState === "failed" ||
    connectionState === "disconnected" ||
    connectionState === "closed";

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-hairline bg-card p-4">
      <div
        className={cn(
          "relative flex h-20 w-20 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground transition",
          speaking && "ring-4 ring-primary/40",
        )}
      >
        {ini}
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-hairline bg-card">
          {isMuted ? (
            <MicOff className="h-3 w-3 text-destructive" />
          ) : (
            <Mic className="h-3 w-3 text-emerald-600" />
          )}
        </span>
      </div>
      <p className="line-clamp-1 max-w-[140px] text-center text-sm font-semibold text-foreground">
        {name} {isLocal && <span className="text-xs text-muted-foreground">(moi)</span>}
      </p>
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {bad ? (
          <>
            <WifiOff className="h-3 w-3" /> Connexion instable
          </>
        ) : (
          <>
            <Wifi className="h-3 w-3" /> {connectionState === "connected" ? "Connecté" : "Connexion…"}
          </>
        )}
      </p>
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}
    </div>
  );
}