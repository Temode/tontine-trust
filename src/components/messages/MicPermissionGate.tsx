import { useEffect, useRef, useState } from "react";
import { Camera, Mic, ShieldCheck, VideoOff } from "lucide-react";

interface Props {
  onGranted: () => void;
  onCancel: () => void;
  /** Also request and preview the camera (default true). */
  withVideo?: boolean;
}

const LS_KEY = "tontine.mic.granted";

export function MicPermissionGate({ onGranted, onCancel, withVideo = true }: Props) {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMic, setHasMic] = useState(false);
  const [hasCam, setHasCam] = useState(false);
  const [micLevel, setMicLevel] = useState(0); // 0..1
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stopPreview = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (audioCtxRef.current) {
      try {
        void audioCtxRef.current.close();
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null;
    }
    if (previewStream) {
      previewStream.getTracks().forEach((t) => t.stop());
    }
    setPreviewStream(null);
  };

  useEffect(() => {
    return () => stopPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (previewStream && videoRef.current) {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  const explain = (err: DOMException, kind: string) => {
    if (err.name === "NotAllowedError")
      return `Accès ${kind} refusé. Cliquez sur l'icône cadenas à gauche de l'URL, autorisez ${kind}, puis rechargez la page.`;
    if (err.name === "NotFoundError") return `Aucun ${kind} détecté sur cet appareil.`;
    if (err.name === "NotReadableError")
      return `Le ${kind} est déjà utilisé par une autre application (Zoom, Meet, OBS...). Fermez-la et réessayez.`;
    if (err.name === "OverconstrainedError")
      return `Aucun ${kind} compatible (résolution ou format non supporté).`;
    if (err.name === "SecurityError")
      return `Le navigateur a bloqué l'accès ${kind} (HTTPS requis).`;
    return err.message || `Impossible d'accéder au ${kind}.`;
  };

  const runTest = async () => {
    setRequesting(true);
    setError(null);
    setHasMic(false);
    setHasCam(false);
    stopPreview();

    // Audio first — required.
    let audioStream: MediaStream;
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      setHasMic(true);
    } catch (e) {
      setError(explain(e as DOMException, "micro"));
      setRequesting(false);
      return;
    }

    // Video — optional fallback.
    let videoStream: MediaStream | null = null;
    if (withVideo) {
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        });
        setHasCam(true);
      } catch (e) {
        // Non-fatal: continue audio-only, but warn.
        const err = e as DOMException;
        setError(`${explain(err, "caméra")} (L'appel pourra démarrer en audio seul.)`);
      }
    }

    // Combine for preview
    const combined = new MediaStream([
      ...audioStream.getTracks(),
      ...(videoStream ? videoStream.getVideoTracks() : []),
    ]);
    setPreviewStream(combined);

    // Live mic-level meter
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        const ctx = new Ctor();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(new MediaStream(audioStream.getAudioTracks()));
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          setMicLevel(Math.min(1, rms * 4));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      }
    } catch {
      /* meter optional */
    }

    setRequesting(false);
  };

  const accept = () => {
    window.localStorage.setItem(LS_KEY, "1");
    stopPreview();
    onGranted();
  };

  // Skip gate entirely if already granted in a previous session.
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem(LS_KEY) === "1") {
      // Still re-test silently to surface "device in use" errors before the call.
      void runTest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-8">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Mic className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">
            Test caméra & micro
          </h2>
          <p className="text-xs text-muted-foreground">
            Vérification avant de rejoindre l'appel.
          </p>
        </div>
      </div>

      {/* Live preview */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-hairline bg-black">
        {previewStream && hasCam ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full scale-x-[-1] object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-primary-foreground/70">
            {previewStream ? (
              <>
                <VideoOff className="h-7 w-7" />
                <span className="text-xs">Pas de caméra — audio seul</span>
              </>
            ) : (
              <>
                <Camera className="h-7 w-7" />
                <span className="text-xs">Cliquez sur « Tester » pour démarrer</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-hairline p-3">
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                hasMic ? "bg-emerald-500" : "bg-muted-foreground/40"
              }`}
            />
            Micro
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-75"
              style={{ width: `${Math.round(micLevel * 100)}%` }}
            />
          </div>
        </div>
        <div className="rounded-lg border border-hairline p-3">
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                hasCam ? "bg-emerald-500" : "bg-muted-foreground/40"
              }`}
            />
            Caméra
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {hasCam ? "Vidéo détectée" : withVideo ? "Non détectée" : "Désactivée"}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive">
          {error}
        </div>
      )}

      <ul className="space-y-1.5 text-[11px] text-muted-foreground">
        <li className="flex gap-1.5">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
          Micro & caméra actifs uniquement pendant cet appel.
        </li>
        <li className="flex gap-1.5">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
          L'enregistrement requiert l'accord de tous les participants.
        </li>
      </ul>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={() => {
            stopPreview();
            onCancel();
          }}
          className="h-11 flex-1 rounded-md border border-hairline text-sm font-semibold text-foreground hover:bg-secondary"
        >
          Annuler
        </button>
        {!hasMic ? (
          <button
            type="button"
            onClick={runTest}
            disabled={requesting}
            className="h-11 flex-1 whitespace-nowrap rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-primary hover:bg-primary-700 disabled:opacity-50"
          >
            {requesting ? "Test en cours…" : "Tester caméra & micro"}
          </button>
        ) : (
          <button
            type="button"
            onClick={accept}
            className="h-11 flex-1 whitespace-nowrap rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-primary hover:bg-primary-700"
          >
            Rejoindre l'appel
          </button>
        )}
      </div>
    </div>
  );
}