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
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { Loader2, PhoneCall, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallTimer } from "@/hooks/useCallTimer";
import { CallStage, usePictureInPicture } from "@/components/messages/CallOverlay";
import { CallMiniPlayer } from "@/components/messages/CallMiniPlayer";
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

interface CallContextValue {
  callId: string | null;
  groupId?: string;
  groupName?: string;
  mode: CallMode;
  status: CallStatus;
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
    setLoading(true);
    setError(null);
    supabase.functions
      .invoke<TokenResponse>("livekit-token", {
        body: { callId: session.callId, displayName },
      })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err || !data?.token) {
          setError(err?.message ?? "Impossible d'obtenir un accès à la salle.");
          setTokenData(null);
          updateCallStatusBestEffort(session.callId, "cancelled");
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
  }, [session, displayName]);

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
    startCall,
    minimize: () => setMode("mini"),
    expand: () => setMode("full"),
    hangup: () => teardown("hangup"),
  };

  const startVideo = session?.prefs ? !session.prefs.camOff : false;
  const startAudio = session?.prefs ? !session.prefs.micMuted : true;

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
                connect
                audio={startAudio}
                video={startVideo}
                onConnected={handleConnected}
                onDisconnected={() => teardown("hangup")}
                onError={(e) => setError(e.message)}
                data-lk-theme="default"
              >
                <RoomAudioRenderer />
                {mode === "full" ? (
                  <div className="fixed inset-0 z-[80] bg-[#0b0d10]">
                    <CallStage
                      callId={session.callId}
                      isHost={tokenData.isHost}
                      groupName={session.groupName}
                      onMinimize={() => setMode("mini")}
                      onHangup={() => teardown("hangup")}
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
                      onHangup={() => teardown("hangup")}
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