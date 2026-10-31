import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { getAttachmentSignedUrl } from "@/lib/api/chatAttachments";

interface Props {
  path: string;
  type: string;
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function VoiceMessagePlayer({ path, type }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAttachmentSignedUrl(path)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      void a.play();
    }
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const v = Number(e.target.value);
    a.currentTime = (v / 100) * duration;
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="mt-1 flex min-w-[220px] items-center gap-3 rounded-lg border border-hairline bg-card px-3 py-2">
      <button
        type="button"
        onClick={toggle}
        disabled={!url}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        aria-label={playing ? "Pause" : "Lire"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
      </button>
      <div className="flex flex-1 flex-col gap-1">
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={onSeek}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
          aria-label="Position"
        />
        <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{fmt(current)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => {
            const d = (e.target as HTMLAudioElement).duration;
            if (isFinite(d)) setDuration(d);
          }}
          onTimeUpdate={(e) => setCurrent((e.target as HTMLAudioElement).currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setCurrent(0);
          }}
        >
          <track kind="captions" />
        </audio>
      )}
    </div>
  );
}