import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";
import { useCallTimer } from "@/hooks/useCallTimer";
import { CallParticipantTile } from "./CallParticipantTile";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  callId: string | null;
  groupName?: string;
}

export function CallRoom({ open, onOpenChange, callId, groupName }: Props) {
  const { user } = useAuth();
  const { status, error, participants, peers, isMuted, toggleMute, leave } =
    useWebRTCCall({ callId, enabled: open });

  const { data: call } = useQuery({
    queryKey: ["call-detail", callId],
    queryFn: async () => {
      if (!callId) return null;
      const { data } = await supabase
        .from("call_requests")
        .select("started_at, topic")
        .eq("id", callId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!callId,
  });

  const duration = useCallTimer(call?.started_at ?? null);

  const handleLeave = async () => {
    await leave();
    onOpenChange(false);
  };

  // Auto-close on errors with no remediation (user dismiss)
  const [showError, setShowError] = useState(false);
  useEffect(() => {
    if (status === "error") setShowError(true);
  }, [status]);

  const activeParticipants = participants.filter((p) => !p.left_at);
  const meParticipant = activeParticipants.find((p) => p.user_id === user?.id);
  const remoteParticipants = activeParticipants.filter((p) => p.user_id !== user?.id);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) void handleLeave();
        else onOpenChange(v);
      }}
    >
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 border-0 p-0 sm:rounded-none">
        <DialogTitle className="sr-only">Appel audio en cours</DialogTitle>

        {/* Header */}
        <header className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div>
            <p className="font-display text-sm font-semibold text-foreground">
              {groupName ?? "Appel audio"}
            </p>
            {call?.topic && (
              <p className="text-xs text-muted-foreground">{call.topic}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-2 w-2 rounded-full",
                status === "live" ? "animate-pulse bg-primary" : "bg-muted-foreground/40",
              )}
            />
            <span className="text-xs font-semibold text-foreground">
              {status === "live" ? "En direct" : status === "connecting" ? "Connexion…" : status === "requesting-mic" ? "Micro…" : "—"}
            </span>
            <span className="ml-3 tabular-nums text-sm font-semibold text-foreground">
              {duration}
            </span>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          {showError && error && (
            <div className="mx-auto mb-6 max-w-md rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-center text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
            <CallParticipantTile
              name={user?.user_metadata?.full_name ?? "Vous"}
              initials={getInitials(user?.user_metadata?.full_name ?? "Moi") ?? "··"}
              isLocal
              isMuted={isMuted}
              connectionState="connected"
            />
            {remoteParticipants.map((p) => {
              const peer = peers[p.user_id];
              return (
                <CallParticipantTile
                  key={p.user_id}
                  name={p.profile?.full_name ?? "Membre"}
                  stream={peer?.stream ?? null}
                  isMuted={p.is_muted}
                  connectionState={peer?.connectionState ?? "connecting"}
                />
              );
            })}
            {remoteParticipants.length === 0 && status === "live" && (
              <div className="col-span-2 flex h-40 items-center justify-center rounded-xl border border-dashed border-hairline text-center text-sm text-muted-foreground sm:col-span-2">
                En attente d'autres participants…
              </div>
            )}
          </div>
        </div>

        {/* Footer / controls */}
        <footer className="flex items-center justify-center gap-4 border-t border-hairline bg-card px-6 py-5">
          <button
            type="button"
            onClick={toggleMute}
            disabled={status !== "live"}
            className={cn(
              "inline-flex h-12 w-12 items-center justify-center rounded-full border border-hairline transition hover:bg-secondary",
              isMuted && "border-destructive/40 bg-destructive/10 text-destructive",
            )}
            aria-label={isMuted ? "Réactiver le micro" : "Couper le micro"}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={handleLeave}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground shadow-md transition hover:opacity-90"
          >
            <PhoneOff className="h-5 w-5" />
            Quitter
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}