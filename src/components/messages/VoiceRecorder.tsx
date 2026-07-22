import { useEffect, useRef, useState } from "react";
import { Mic, Send, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadChatAttachment, type UploadedAttachment } from "@/lib/api/chatAttachments";

interface Props {
  groupId: string;
  disabled?: boolean;
  onRecorded: (a: UploadedAttachment) => void;
}

function pickMime(): string | null {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
  if (typeof MediaRecorder === "undefined") return null;
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const MAX_SECONDS = 180;

export function VoiceRecorder({ groupId, disabled, onRecorded }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "uploading">("idle");
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAll = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
  };

  const start = async () => {
    const mime = pickMime();
    if (!mime) {
      toast.error("Enregistrement non supporté", {
        description: "Votre navigateur ne supporte pas l'enregistrement audio.",
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      cancelledRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        stopAll();
        setElapsed(0);
        if (cancelledRef.current || blob.size < 1024) {
          setState("idle");
          if (!cancelledRef.current) {
            toast.error("Enregistrement trop court");
          }
          return;
        }
        setState("uploading");
        try {
          const ext = mime.includes("mp4") ? "m4a" : mime.includes("mpeg") ? "mp3" : "webm";
          const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mime.split(";")[0] });
          const up = await uploadChatAttachment(groupId, file);
          onRecorded(up);
        } catch (e) {
          toast.error("Envoi impossible", { description: (e as Error).message });
        } finally {
          setState("idle");
        }
      };
      rec.start();
      recRef.current = rec;
      setState("recording");
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed((s) => {
          const next = s + 1;
          if (next >= MAX_SECONDS) {
            stop();
          }
          return next;
        });
      }, 1000);
    } catch (e) {
      toast.error("Micro indisponible", {
        description: (e as Error).message || "Autorisez l'accès au microphone.",
      });
    }
  };

  const stop = () => {
    if (recRef.current && recRef.current.state !== "inactive") {
      cancelledRef.current = false;
      recRef.current.stop();
    }
  };

  const cancel = () => {
    if (recRef.current && recRef.current.state !== "inactive") {
      cancelledRef.current = true;
      recRef.current.stop();
      setState("idle");
      setElapsed(0);
    }
  };

  if (state === "recording") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-hairline bg-secondary px-2 py-1.5 text-xs">
        <span className="flex h-2 w-2 animate-pulse rounded-full bg-destructive" aria-hidden />
        <span className="tabular-nums text-foreground">{fmt(elapsed)}</span>
        <button
          type="button"
          onClick={cancel}
          className="ml-1 text-muted-foreground hover:text-destructive"
          aria-label="Annuler"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={stop}
          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90"
          aria-label="Envoyer le message vocal"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (state === "uploading") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-hairline bg-secondary px-2 py-1.5 text-xs">
        <Square className="h-3.5 w-3.5 animate-pulse text-primary" />
        <span className="text-muted-foreground">Envoi…</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={start}
      className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
      aria-label="Enregistrer un message vocal"
      title="Message vocal (max 3 min)"
    >
      <Mic className="h-4 w-4" />
    </button>
  );
}