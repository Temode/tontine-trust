import { useEffect, useMemo, useState } from "react";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useParticipants,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import { Loader2, PhoneOff, ShieldAlert, Users } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { PreCallDevicePrefs } from "./MicPermissionGate";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  callId: string | null;
  groupName?: string;
  groupId?: string;
  initialPrefs?: PreCallDevicePrefs | null;
}

interface TokenResponse {
  token: string;
  wsUrl: string;
  roomName: string;
  identity: string;
}

export function CallRoom({ open, onOpenChange, callId, groupName, initialPrefs }: Props) {
  const { user } = useAuth();
  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const displayName = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    return (
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      user?.email ||
      "Participant"
    );
  }, [user]);

  useEffect(() => {
    if (!open || !callId) {
      setTokenData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.functions
      .invoke<TokenResponse>("livekit-token", {
        body: { callId, displayName },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.token) {
          setError(error?.message ?? "Impossible d'obtenir un accès à la salle.");
          setTokenData(null);
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
  }, [open, callId, displayName]);

  const startVideo = initialPrefs ? !initialPrefs.camOff : false;
  const startAudio = initialPrefs ? !initialPrefs.micMuted : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:h-[85vh]">
        <DialogTitle className="sr-only">
          Appel {groupName ? `— ${groupName}` : ""}
        </DialogTitle>

        <header className="flex items-center justify-between border-b border-hairline bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4 text-primary" />
            {groupName ?? "Appel de groupe"}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-hairline px-3 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            <PhoneOff className="h-4 w-4" />
            Quitter
          </button>
        </header>

        <div className="relative flex-1 bg-[#0b0d10]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Connexion à la salle…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <ShieldAlert className="h-8 w-8 text-destructive" />
              <p className="max-w-sm text-sm text-foreground">{error}</p>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="mt-2 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Fermer
              </button>
            </div>
          )}
          {tokenData && !error && (
            <LiveKitRoom
              token={tokenData.token}
              serverUrl={tokenData.wsUrl}
              connect
              audio={startAudio}
              video={startVideo}
              onDisconnected={() => onOpenChange(false)}
              onError={(e) => setError(e.message)}
              className={cn("flex h-full w-full flex-col")}
              data-lk-theme="default"
            >
              <RoomAudioRenderer />
              <RoomStage />
              <div className="border-t border-hairline bg-card/95 px-2 py-2">
                <ControlBar
                  controls={{
                    microphone: true,
                    camera: true,
                    screenShare: true,
                    chat: false,
                    leave: true,
                  }}
                />
              </div>
            </LiveKitRoom>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoomStage() {
  const participants = useParticipants();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <div className="flex-1 overflow-hidden p-2">
      {participants.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-white/70">
          En attente d'autres participants…
        </div>
      ) : (
        <GridLayout tracks={tracks} className="h-full">
          <ParticipantTile />
        </GridLayout>
      )}
    </div>
  );
}