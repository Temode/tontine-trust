import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { Loader2, PhoneCall, ShieldAlert, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallTimer } from "@/hooks/useCallTimer";
import { CallStage, usePictureInPicture } from "@/components/messages/CallOverlay";
import { CallMiniPlayer } from "@/components/messages/CallMiniPlayer";
import { AudioOutputControl } from "@/components/messages/AudioOutputControl";
import type { PreCallDevicePrefs } from "@/components/messages/MicPermissionGate";

export interface StartCallArgs {
  callId: string;
  groupId?: string;
  groupName?: string;
  prefs?: PreCallDevicePrefs | null;
  manageLifecycle?: boolean;
  cancelOnCloseBeforeJoin?: boolean;
}

type CallMode = "full" | "mini" | "pip";
type CallStatus = "idle" | "connecting" | "connected" | "error";
type NetState = "online" | "reconnecting" | "lost";

const MAX_RECONNECT_ATTEMPTS = 3;

/** Mode bouchon utilisé uniquement par les tests E2E (aucun réseau LiveKit). */
const isStubCall = (callId: string) => callId.startsWith("e2e-stub");

interface CallContextValue {
  callId: string | null;
  groupId?: string;
  groupName?: string;
  mode: CallMode;
  status: CallStatus;
  netState: NetState;
  startCall: (args: StartCallArgs) => void;
  minimize: () => void;
  expand: () => void;
  hangup: () => void;
}

const Ctx = createContext<CallContextValue | null>(null);

type ManagedCallStatus = "accepted" | "cancelled" | "ended";

function updateCallStatusBestEffort(callId: string, status: ManagedCallStatus): void {
  void supabase
    .rpc("respond_call_request", { p_id: callId, p_status: status })
    .then(
      () => {},
      () => {},
    );
}

interface TokenResponse {
  token: string;
  wsUrl: string;
  roomName: string;
  identity: string;
  isHost: boolean;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [session, setSession] = useState<StartCallArgs | null>(null);
  const [mode, setMode] = useState<CallMode>("full");
  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const hasConnectedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const intentionalRef = useRef(false);
  const [netState, setNetState] = useState<NetState>("online");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const displayName = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    return (
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      user?.email ||
      "Participant"
    );
  }, [user]);

  const pip = usePictureInPicture(
    () => containerRef.current?.querySelector("video") ?? null,
  );

  const teardown = useCallback(
    (reason: "hangup" | "error") => {
      const s = session;
      if (s) {
        if (s.manageLifecycle && hasConnectedRef.current) {
          updateCallStatusBestEffort(s.callId, "ended");
        } else if (
          (s.cancelOnCloseBeforeJoin || reason === "error") &&
          !hasConnectedRef.current
        ) {
          updateCallStatusBestEffort(s.callId, "cancelled");
        }
      }
      hasConnectedRef.current = false;
      setSession(null);
      setTokenData(null);
      setError(null);
      setConnectedAt(null);
      setMode("full");
      setNetState("online");
      setReconnectAttempt(0);
      intentionalRef.current = false;
      if (typeof document !== "undefined" && document.pictureInPictureElement) {
        void document.exitPictureInPicture().catch(() => {});
      }
    },
    [session],
  );

  const startCall = useCallback(
    (args: StartCallArgs) => {
      if (session && session.callId !== args.callId) {
        toast("Un appel est déjà en cours", {
          description: "Voulez-vous basculer vers ce nouvel appel ?",
          action: {
            label: "Basculer",
            onClick: () => {
              teardown("hangup");
              hasConnectedRef.current = false;
              setError(null);
              setMode("full");
              setSession(args);
            },
          },
        });
        return;
      }
      if (session && session.callId === args.callId) {
        setMode("full");
        return;
      }
      hasConnectedRef.current = false;
      setError(null);
      setMode("full");
      setSession(args);
    },
    [session, teardown],
  );

  // Récupération du token LiveKit
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    if (isStubCall(session.callId)) {
      setTokenData({
        token: "stub",
        wsUrl: "wss://stub.invalid",
        roomName: session.callId,
        identity: "stub",
        isHost: true,
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    supabase.functions
      .invoke<TokenResponse>("livekit-token", {
        body: { callId: session.callId, displayName },
      })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err || !data?.token) {
          setTokenData(null);
          if (hasConnectedRef.current && reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
            // Échec pendant une reprise : on retentera via le backoff
            setNetState("lost");
          } else {
            setError(err?.message ?? "Impossible d'obtenir un accès à la salle.");
            if (!hasConnectedRef.current) {
              updateCallStatusBestEffort(session.callId, "cancelled");
            }
          }
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
    // reconnectAttempt force une nouvelle demande de token à chaque tentative
  }, [session, displayName, reconnectAttempt]);

  /** Reprise automatique : nouveau token + reconnexion, avec backoff. */
  const scheduleReconnect = useCallback(() => {
    setNetState("lost");
    setTokenData(null);
    setReconnectAttempt((a) => a + 1);
  }, []);

  useEffect(() => {
    if (!session || netState !== "lost") return;
    if (reconnectAttempt > MAX_RECONNECT_ATTEMPTS) return;
    const delay = Math.min(8000, 1000 * 2 ** Math.max(0, reconnectAttempt - 1));
    const t = window.setTimeout(() => {
      setReconnectAttempt((a) => a + 1);
    }, delay);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netState, session]);

  const handleDisconnected = useCallback(() => {
    if (intentionalRef.current || !hasConnectedRef.current) {
      teardown("hangup");
      return;
    }
    if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      toast.error("Appel interrompu", {
        description: "La connexion n'a pas pu être rétablie.",
      });
      teardown("hangup");
      return;
    }
    toast("Connexion perdue", { description: "Reprise de l'appel en cours…" });
    scheduleReconnect();
  }, [reconnectAttempt, scheduleReconnect, teardown]);

  const hangup = useCallback(() => {
    intentionalRef.current = true;
    teardown("hangup");
  }, [teardown]);

  // Échap réduit l'appel, ne raccroche jamais
  useEffect(() => {
    if (!session) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mode === "full") {
        e.preventDefault();
        setMode("mini");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [session, mode]);

  // Avertissement avant fermeture d'onglet
  useEffect(() => {
    if (!session) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [session]);

  // Auto Picture-in-Picture quand l'onglet passe en arrière-plan
  useEffect(() => {
    if (!session || !pip.supported) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && !document.pictureInPictureElement) {
        void pip.toggle();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [session, pip]);

  const handleConnected = () => {
    hasConnectedRef.current = true;
    setConnectedAt(new Date().toISOString());
    if (session?.manageLifecycle) {
      updateCallStatusBestEffort(session.callId, "accepted");
    }
  };

  const value: CallContextValue = {
    callId: session?.callId ?? null,
    groupId: session?.groupId,
    groupName: session?.groupName,
    mode: pip.active ? "pip" : mode,
    status: error
      ? "error"
      : !session
        ? "idle"
        : hasConnectedRef.current
          ? "connected"
          : "connecting",
    netState,
    startCall,
    minimize: () => setMode("mini"),
    expand: () => setMode("full"),
    hangup,
  };

  const startVideo = session?.prefs ? !session.prefs.camOff : false;
  const startAudio = session?.prefs ? !session.prefs.micMuted : true;
  const stub = !!session && isStubCall(session.callId);

  // Pilotage des tests E2E (dev uniquement)
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    (window as unknown as Record<string, unknown>).__lovableCall = {
      startCall,
      minimize: () => setMode("mini"),
      expand: () => setMode("full"),
      hangup,
      mode: pip.active ? "pip" : mode,
      netState,
    };
  }, [startCall, hangup, mode, netState, pip.active]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {typeof document !== "undefined" &&
        session &&
        createPortal(
          <div ref={containerRef}>
            {mode === "full" && (loading || error) && (
              <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-[#0b0d10] p-6 text-center">
                {error ? (
                  <>
                    <ShieldAlert className="h-8 w-8 text-destructive" />
                    <p className="max-w-sm text-sm text-white">{error}</p>
                    <button
                      type="button"
                      onClick={() => teardown("error")}
                      className="mt-2 inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
                    >
                      Fermer
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Connexion à la salle…
                  </div>
                )}
              </div>
            )}

            {tokenData && !error && (
              <LiveKitRoom
                token={tokenData.token}
                serverUrl={tokenData.wsUrl}
                connect={!stub}
                audio={startAudio}
                video={startVideo}
                onConnected={handleConnected}
                onDisconnected={handleDisconnected}
                onError={(e) => {
                  if (stub) return;
                  if (hasConnectedRef.current) {
                    handleDisconnected();
                  } else {
                    setError(e.message);
                  }
                }}
                data-lk-theme="default"
              >
                <RoomAudioRenderer />
                <RoomMountProbe />
                <ConnectionWatcher
                  onReconnecting={() => setNetState("reconnecting")}
                  onRestored={() => {
                    setNetState("online");
                    setReconnectAttempt(0);
                  }}
                />
                {netState !== "online" && (
                  <ReconnectBanner
                    netState={netState}
                    attempt={reconnectAttempt}
                    onRetry={scheduleReconnect}
                    onHangup={hangup}
                  />
                )}
                {mode === "full" ? (
                  <div className="fixed inset-0 z-[80] bg-[#0b0d10]">
                    <CallStage
                      callId={session.callId}
                      isHost={tokenData.isHost}
                      groupName={session.groupName}
                      onMinimize={() => setMode("mini")}
                      onHangup={hangup}
                      onTogglePip={() => void pip.toggle()}
                      pipSupported={pip.supported}
                      pipActive={pip.active}
                    />
                  </div>
                ) : (
                  <>
                    <CallActiveBanner
                      groupName={session.groupName}
                      connectedAt={connectedAt}
                      onExpand={() => setMode("full")}
                    />
                    <MiniPlayerWithTimer
                      groupName={session.groupName}
                      connectedAt={connectedAt}
                      onExpand={() => setMode("full")}
                      onHangup={hangup}
                      onTogglePip={() => void pip.toggle()}
                      pipSupported={pip.supported}
                    />
                  </>
                )}
              </LiveKitRoom>
            )}
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}

/**
 * Sonde de cycle de vie : compte les montages du sous-arbre <LiveKitRoom>.
 * Sert aux tests E2E à prouver que la salle n'est jamais démontée.
 */
function RoomMountProbe() {
  useEffect(() => {
    const w = window as unknown as Record<string, number>;
    w.__livekitRoomMounts = (w.__livekitRoomMounts ?? 0) + 1;
    return () => {
      w.__livekitRoomUnmounts = (w.__livekitRoomUnmounts ?? 0) + 1;
    };
  }, []);
  return <span data-testid="livekit-room-probe" className="hidden" aria-hidden />;
}

function ConnectionWatcher({
  onReconnecting,
  onRestored,
}: {
  onReconnecting: () => void;
  onRestored: () => void;
}) {
  const state = useConnectionState();
  useEffect(() => {
    if (state === ConnectionState.Reconnecting) onReconnecting();
    if (state === ConnectionState.Connected) onRestored();
  }, [state, onReconnecting, onRestored]);
  return null;
}

function ReconnectBanner({
  netState,
  attempt,
  onRetry,
  onHangup,
}: {
  netState: NetState;
  attempt: number;
  onRetry: () => void;
  onHangup: () => void;
}) {
  return (
    <div
      data-testid="call-reconnect-banner"
      className="fixed inset-x-0 top-0 z-[90] flex flex-wrap items-center justify-center gap-2 bg-destructive px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-[11px] font-semibold text-destructive-foreground sm:text-xs"
    >
      {netState === "reconnecting" ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="truncate">
        {netState === "reconnecting"
          ? "Reconnexion en cours…"
          : `Connexion perdue — reprise (${Math.min(attempt, MAX_RECONNECT_ATTEMPTS)}/${MAX_RECONNECT_ATTEMPTS})`}
      </span>
      <div className="flex items-center gap-1">
        <AudioOutputControl variant="banner" />
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-black/20 px-2 py-1 text-[11px] font-semibold"
        >
          Réessayer
        </button>
        <button
          type="button"
          onClick={onHangup}
          className="rounded-full bg-black/30 px-2 py-1 text-[11px] font-semibold"
        >
          Quitter
        </button>
      </div>
    </div>
  );
}

function MiniPlayerWithTimer({
  groupName,
  connectedAt,
  onExpand,
  onHangup,
  onTogglePip,
  pipSupported,
}: {
  groupName?: string;
  connectedAt: string | null;
  onExpand: () => void;
  onHangup: () => void;
  onTogglePip: () => void;
  pipSupported: boolean;
}) {
  const elapsed = useCallTimer(connectedAt);
  return (
    <CallMiniPlayer
      groupName={groupName}
      elapsed={elapsed}
      onExpand={onExpand}
      onHangup={onHangup}
      onTogglePip={onTogglePip}
      pipSupported={pipSupported}
    />
  );
}

function CallActiveBanner({
  groupName,
  connectedAt,
  onExpand,
}: {
  groupName?: string;
  connectedAt: string | null;
  onExpand: () => void;
}) {
  const elapsed = useCallTimer(connectedAt);
  return (
    <button
      type="button"
      onClick={onExpand}
      className="fixed inset-x-0 top-0 z-[84] flex min-h-8 w-full items-center justify-center gap-2 bg-primary px-3 pt-[env(safe-area-inset-top)] text-[11px] font-semibold text-primary-foreground shadow-primary sm:text-xs"
    >
      <PhoneCall className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        Appel en cours{groupName ? ` — ${groupName}` : ""} · {elapsed}
      </span>
      <span className="shrink-0 underline underline-offset-2">Revenir</span>
    </button>
  );
}

export function useCall(): CallContextValue {
  const v = useContext(Ctx);
  if (!v) {
    return {
      callId: null,
      mode: "full",
      status: "idle",
      startCall: () => {},
      minimize: () => {},
      expand: () => {},
      hangup: () => {},
    };
  }
  return v;
}