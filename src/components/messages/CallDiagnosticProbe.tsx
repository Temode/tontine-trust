import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent, type ConnectionState, type DisconnectReason } from "livekit-client";
import { callTraceEnabled, recordCallTrace } from "@/lib/diagnostics/callTrace";

export function CallDiagnosticProbe() {
  const room = useRoomContext();
  useEffect(() => {
    if (!callTraceEnabled()) return;
    const state = (value: ConnectionState) => recordCallTrace("connection-state", { state: value });
    const disconnect = (reason?: DisconnectReason) => recordCallTrace("disconnected", { reason: reason ?? null });
    const reconnecting = () => recordCallTrace("reconnecting");
    const restored = () => recordCallTrace("reconnected");
    const network = () => recordCallTrace("browser-network", { online: navigator.onLine });
    room.on(RoomEvent.ConnectionStateChanged, state);
    room.on(RoomEvent.Disconnected, disconnect);
    room.on(RoomEvent.Reconnecting, reconnecting);
    room.on(RoomEvent.Reconnected, restored);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    const timer = window.setInterval(() => {
      void (async () => {
        let sent = 0, received = 0, remoteAudioTracks = 0;
        const participants = [room.localParticipant, ...room.remoteParticipants.values()];
        for (const participant of participants) {
          for (const publication of participant.audioTrackPublications.values()) {
            if (!publication.track) continue;
            if (participant !== room.localParticipant) remoteAudioTracks += 1;
            const report = await publication.track.getRTCStatsReport();
            report?.forEach((row) => {
              if (row.type === "outbound-rtp") sent += row.bytesSent ?? 0;
              if (row.type === "inbound-rtp") received += row.bytesReceived ?? 0;
              if (row.type === "transport") recordCallTrace("transport", { dtlsState: row.dtlsState ?? null, iceState: row.iceState ?? null });
              if (row.type === "candidate-pair" && row.nominated) recordCallTrace("candidate-pair", { state: row.state, bytesSent: row.bytesSent ?? 0, bytesReceived: row.bytesReceived ?? 0 });
            });
          }
        }
        recordCallTrace("audio-stats", { sent, received, remoteAudioTracks, participants: participants.length, state: room.state });
      })().catch(() => recordCallTrace("stats-unavailable"));
    }, 2000);
    return () => {
      clearInterval(timer);
      room.off(RoomEvent.ConnectionStateChanged, state);
      room.off(RoomEvent.Disconnected, disconnect);
      room.off(RoomEvent.Reconnecting, reconnecting);
      room.off(RoomEvent.Reconnected, restored);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
    };
  }, [room]);
  return null;
}