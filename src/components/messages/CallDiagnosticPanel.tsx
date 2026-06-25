import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Mic,
  MicOff,
  RotateCw,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useIncomingCallsContext } from "@/hooks/IncomingCallsContext";
import { useAppVersion } from "@/hooks/useAppVersion";
import { fetchIceServers } from "@/lib/api/calls";
import { useAudioAudit } from "@/hooks/useAudioAudit";
import { cn } from "@/lib/utils";

type AudioState = "untested" | "ok" | "blocked" | "muted";

function StatusDot({
  tone,
}: {
  tone: "ok" | "warn" | "error" | "idle";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500"
      : tone === "warn"
        ? "bg-amber-500"
        : tone === "error"
          ? "bg-destructive"
          : "bg-muted-foreground/40";
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        cls,
        tone === "ok" && "animate-pulse",
      )}
    />
  );
}

export function CallDiagnosticPanel() {
  const { status, groupCount, lastEventAt, pendingCount, events } =
    useIncomingCallsContext();
  const { outdated, latestHash, refresh } = useAppVersion();
  const [open, setOpen] = useState(false);
  const [ice, setIce] = useState<{ servers: number; turn: boolean } | null>(null);
  const [iceLoading, setIceLoading] = useState(false);
  const [audio, setAudio] = useState<AudioState>("untested");
  const [now, setNow] = useState(Date.now());
  const [auditMode, setAuditMode] = useState(false);
  const audit = useAudioAudit(auditMode);

  // Re-render toutes les 5s pour le compteur "dernier event"
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  // ICE servers (au premier déploiement du panneau)
  useEffect(() => {
    if (!open || ice || iceLoading) return;
    setIceLoading(true);
    fetchIceServers()
      .then((r) => setIce({ servers: r.iceServers.length, turn: r.turn }))
      .catch(() => setIce({ servers: 0, turn: false }))
      .finally(() => setIceLoading(false));
  }, [open, ice, iceLoading]);

  // Test audio : joue un bip court et vérifie l'AudioContext
  const testAudio = async () => {
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) {
        setAudio("blocked");
        return;
      }
      const ctx = new Ctor();
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
          setAudio("blocked");
          return;
        }
      }
      if (ctx.state !== "running") {
        setAudio("muted");
        await ctx.close();
        return;
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      setAudio("ok");
      setTimeout(() => void ctx.close(), 700);
    } catch {
      setAudio("blocked");
    }
  };

  const rtTone =
    status === "subscribed"
      ? "ok"
      : status === "connecting"
        ? "warn"
        : status === "no_groups"
          ? "idle"
          : "error";

  const rtLabel =
    status === "subscribed"
      ? "Abonné aux appels entrants"
      : status === "connecting"
        ? "Connexion en cours…"
        : status === "no_groups"
          ? "Aucun groupe actif"
          : status === "timeout"
            ? "Timeout Realtime — recharge la page"
            : status === "error"
              ? "Erreur Realtime — vérifie la connexion"
              : status === "closed"
                ? "Canal fermé"
                : "Inactif";

  const sinceLast = lastEventAt
    ? Math.max(0, Math.round((now - lastEventAt) / 1000))
    : null;

  const pollIntervalLabel = useMemo(() => {
    if (status === "subscribed") return "60s (sécurité)";
    if (status === "connecting") return "5s";
    if (status === "no_groups" || status === "idle") return "—";
    return "3s (mode dégradé)";
  }, [status]);

  const exportJson = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            realtime: {
              status,
              groupCount,
              pendingCount,
              lastEventAt,
              pollInterval: pollIntervalLabel,
              events,
            },
            ice,
            audio: { lastTest: audio },
            audit: auditMode ? audit : null,
            version: { latestHash, outdated },
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tontine-diag-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="fixed bottom-24 right-4 z-[60] sm:bottom-6 sm:right-6">
      {/* Bandeau version obsolète (toujours visible si nécessaire) */}
      {outdated && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-foreground shadow-md">
          <AlertTriangle className="h-4 w-4 text-accent" />
          Nouvelle version disponible
          <button
            type="button"
            onClick={refresh}
            className="ml-2 inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground hover:opacity-90"
          >
            <RotateCw className="h-3 w-3" />
            Recharger
          </button>
        </div>
      )}

      {/* Badge compact */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-hairline bg-card px-3 py-2 text-xs font-semibold shadow-md transition hover:bg-secondary",
            rtTone === "error" && "border-destructive/40 text-destructive",
          )}
          aria-label="Ouvrir le panneau diagnostic"
        >
          <StatusDot tone={rtTone} />
          {status === "subscribed" ? (
            <Wifi className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="hidden sm:inline">{rtLabel}</span>
          <ChevronUp className="h-3 w-3" />
        </button>
      )}

      {/* Panneau étendu */}
      {open && (
        <div className="w-72 rounded-xl border border-hairline bg-card p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <p className="font-display text-sm font-semibold">Diagnostic appels</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
              aria-label="Fermer"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <ul className="space-y-2.5 text-xs">
            <li className="flex items-start gap-2">
              <StatusDot tone={rtTone} />
              <div className="flex-1">
                <p className="font-semibold text-foreground">Realtime</p>
                <p className="text-muted-foreground">{rtLabel}</p>
                {sinceLast !== null && (
                  <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                    Dernier event : il y a {sinceLast}s
                  </p>
                )}
              </div>
            </li>

            <li className="flex items-start gap-2">
              <StatusDot tone={groupCount > 0 ? "ok" : "warn"} />
              <div className="flex-1">
                <p className="font-semibold text-foreground">Groupes actifs</p>
                <p className="text-muted-foreground tabular-nums">{groupCount}</p>
              </div>
            </li>

            <li className="flex items-start gap-2">
              <StatusDot
                tone={
                  pendingCount > 0 ? "warn" : "ok"
                }
              />
              <div className="flex-1">
                <p className="font-semibold text-foreground">Appels en attente</p>
                <p className="text-muted-foreground tabular-nums">
                  {pendingCount} · poll {pollIntervalLabel}
                </p>
              </div>
            </li>

            <li className="flex items-start gap-2">
              <StatusDot
                tone={
                  ice === null ? "idle" : ice.turn ? "ok" : ice.servers > 0 ? "warn" : "error"
                }
              />
              <div className="flex-1">
                <p className="font-semibold text-foreground">ICE / WebRTC</p>
                <p className="text-muted-foreground">
                  {ice === null
                    ? iceLoading
                      ? "Vérification…"
                      : "—"
                    : ice.turn
                      ? `${ice.servers} serveurs · TURN actif`
                      : ice.servers > 0
                        ? `${ice.servers} serveurs · STUN seul`
                        : "Aucun serveur"}
                </p>
              </div>
            </li>

            <li className="flex items-start gap-2">
              <StatusDot
                tone={
                  audio === "ok"
                    ? "ok"
                    : audio === "untested"
                      ? "idle"
                      : "error"
                }
              />
              <div className="flex-1">
                <p className="flex items-center gap-1 font-semibold text-foreground">
                  {audio === "muted" || audio === "blocked" ? (
                    <VolumeX className="h-3 w-3" />
                  ) : (
                    <Volume2 className="h-3 w-3" />
                  )}
                  Audio
                </p>
                <p className="text-muted-foreground">
                  {audio === "ok"
                    ? "OK — bip joué"
                    : audio === "muted"
                      ? "Onglet/navigateur muet"
                      : audio === "blocked"
                        ? "Bloqué par le navigateur"
                        : "Cliquer pour tester"}
                </p>
                <button
                  type="button"
                  onClick={testAudio}
                  className="mt-1 inline-flex items-center gap-1 rounded-md border border-hairline px-2 py-1 text-[10px] font-semibold hover:bg-secondary"
                >
                  <Volume2 className="h-3 w-3" />
                  Tester la sonnerie
                </button>
              </div>
            </li>

            <li className="flex items-start gap-2">
              <StatusDot tone={outdated ? "warn" : "ok"} />
              <div className="flex-1">
                <p className="font-semibold text-foreground">Version client</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {latestHash ?? "—"}
                </p>
                {outdated && (
                  <button
                    type="button"
                    onClick={refresh}
                    className="mt-1 inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground hover:opacity-90"
                  >
                    <RotateCw className="h-3 w-3" />
                    Recharger
                  </button>
                )}
              </div>
            </li>
          </ul>

          {/* Mode audit */}
          <div className="mt-3 rounded-lg border border-hairline p-2">
            <label className="flex cursor-pointer items-center justify-between text-[11px] font-semibold">
              <span className="flex items-center gap-1">
                {auditMode ? <Mic className="h-3 w-3 text-primary" /> : <MicOff className="h-3 w-3 text-muted-foreground" />}
                Mode audit audio
              </span>
              <input
                type="checkbox"
                checked={auditMode}
                onChange={(e) => setAuditMode(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
            </label>
            {auditMode && (
              <dl className="mt-2 space-y-1 text-[10px] text-muted-foreground">
                <div className="flex justify-between">
                  <dt>Autoplay</dt>
                  <dd
                    className={cn(
                      "font-semibold",
                      audit.autoplay === "allowed"
                        ? "text-emerald-600"
                        : audit.autoplay === "blocked"
                          ? "text-destructive"
                          : "text-foreground",
                    )}
                  >
                    {audit.autoplay}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Permission micro</dt>
                  <dd
                    className={cn(
                      "font-semibold",
                      audit.micPermission === "granted"
                        ? "text-emerald-600"
                        : audit.micPermission === "denied"
                          ? "text-destructive"
                          : "text-foreground",
                    )}
                  >
                    {audit.micPermission}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Périphériques in/out</dt>
                  <dd className="tabular-nums">
                    {audit.inputDevices}/{audit.outputDevices}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>SampleRate</dt>
                  <dd className="tabular-nums">
                    {audit.sampleRate ? `${audit.sampleRate} Hz` : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Contexte</dt>
                  <dd>{audit.contextState ?? "—"}</dd>
                </div>
                <div>
                  <div className="mb-0.5 flex justify-between">
                    <dt>Niveau micro</dt>
                    <dd className="tabular-nums">
                      {audit.micLevel !== null
                        ? `${(audit.micLevel * 100).toFixed(0)}%`
                        : "—"}
                    </dd>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(100, (audit.micLevel ?? 0) * 300)}%`,
                      }}
                    />
                  </div>
                </div>
                {audit.lastError && (
                  <p className="mt-1 text-destructive">{audit.lastError}</p>
                )}
              </dl>
            )}
          </div>

          {/* Export JSON */}
          <button
            type="button"
            onClick={exportJson}
            className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md border border-hairline bg-secondary px-2 py-2 text-[11px] font-semibold hover:bg-secondary/80"
          >
            <Download className="h-3 w-3" />
            Exporter le journal JSON
          </button>

          {status === "subscribed" && (
            <p className="mt-3 flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Vous recevrez les appels entrants en direct.
            </p>
          )}
        </div>
      )}
    </div>
  );
}