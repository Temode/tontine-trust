import { useEffect, useRef, useState } from "react";
import {
  ParticipantTile,
  useTracks,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import type { LocalParticipant } from "livekit-client";
import { Maximize2, Mic, MicOff, PhoneOff, PictureInPicture2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  groupName?: string;
  elapsed: string;
  onExpand: () => void;
  onHangup: () => void;
  onTogglePip: () => void;
  pipSupported: boolean;
}

/** Position mémorisée entre deux montages du mini-player. */
let lastPos: { x: number; y: number } | null = null;

export function CallMiniPlayer({
  groupName,
  elapsed,
  onExpand,
  onHangup,
  onTogglePip,
  pipSupported,
}: Props) {
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const speaking = tracks.find((t) => t.participant.isSpeaking && t.publication);
  const remote = tracks.find(
    (t) => t.participant.identity !== localParticipant?.identity && t.publication,
  );
  const featured = speaking ?? remote ?? tracks.find((t) => t.publication);

  const [pos, setPos] = useState(() => lastPos);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    lastPos = pos;
  }, [pos]);

  // La confirmation de raccrochage retombe d'elle-même
  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  // Repositionne dans l'écran après un resize / une rotation
  useEffect(() => {
    const onResize = () => {
      const rect = boxRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos((p) =>
        p
          ? {
              x: Math.min(Math.max(8, p.x), window.innerWidth - rect.width - 8),
              y: Math.min(Math.max(8, p.y), window.innerHeight - rect.height - 8),
            }
          : p,
      );
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const x = Math.min(
      Math.max(8, e.clientX - d.dx),
      window.innerWidth - rect.width - 8,
    );
    const y = Math.min(
      Math.max(8, e.clientY - d.dy),
      window.innerHeight - rect.height - 8,
    );
    setPos({ x, y });
  };

  const onPointerUp = () => {
    const wasDragging = !!dragRef.current;
    dragRef.current = null;
    if (!wasDragging) return;
    // Aimantation au coin le plus proche
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 12;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setPos({
      x: cx < window.innerWidth / 2 ? margin : window.innerWidth - rect.width - margin,
      y:
        cy < window.innerHeight / 2
          ? margin
          : window.innerHeight - rect.height - margin,
    });
  };

  const micOn = (localParticipant as LocalParticipant | undefined)?.isMicrophoneEnabled;

  return (
    <div
      ref={boxRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={
        pos
          ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
          : undefined
      }
      className={cn(
        "fixed z-[85] w-[min(46vw,200px)] touch-none overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d10] shadow-elegant",
        "animate-in fade-in zoom-in-95 duration-200 transition-[left,top] ease-out",
        !pos &&
          "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 lg:bottom-6 lg:right-6",
      )}
      role="region"
      aria-label="Appel en cours réduit"
    >
      <button
        type="button"
        onClick={onExpand}
        className="relative block aspect-[200/118] w-full bg-black"
        aria-label="Agrandir l'appel"
      >
        {featured ? (
          <ParticipantTile
            trackRef={featured}
            className="!h-full !w-full !rounded-none [&_video]:!object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs text-white/70">
            Appel audio
          </span>
        )}
        <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {elapsed}
        </span>
        {groupName && (
          <span className="pointer-events-none absolute inset-x-1.5 bottom-1.5 truncate rounded-md bg-black/55 px-1.5 py-0.5 text-left text-[10px] text-white">
            {groupName}
          </span>
        )}
      </button>

      <div className="flex flex-wrap items-center justify-center gap-1 px-1.5 py-2 sm:justify-between sm:px-2">
        <button
          type="button"
          onClick={() =>
            (localParticipant as LocalParticipant | undefined)?.setMicrophoneEnabled(!micOn)
          }
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition",
            micOn ? "bg-white/10 hover:bg-white/20" : "bg-destructive/80",
          )}
          aria-label={micOn ? "Couper le micro" : "Activer le micro"}
        >
          {micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
        </button>
        {pipSupported && (
          <button
            type="button"
            onClick={onTogglePip}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 min-[380px]:inline-flex"
            aria-label="Picture-in-Picture"
          >
            <PictureInPicture2 className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onExpand}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Agrandir l'appel"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            onHangup();
          }}
          className={cn(
            "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full bg-destructive text-destructive-foreground transition hover:opacity-90",
            confirming ? "px-2 text-[10px] font-semibold" : "w-8",
          )}
          aria-label={confirming ? "Confirmer et raccrocher" : "Raccrocher"}
        >
          <PhoneOff className="h-3.5 w-3.5" />
          {confirming && <span>Confirmer</span>}
        </button>
      </div>
    </div>
  );
}