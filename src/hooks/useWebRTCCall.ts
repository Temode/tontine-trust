import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  joinCall,
  leaveCall,
  listCallParticipants,
  setCallMute,
  subscribeCallParticipants,
  type CallParticipant,
} from "@/lib/api/calls";

export type CallConnectionStatus = "idle" | "requesting-mic" | "connecting" | "live" | "error";

export interface RemotePeer {
  user_id: string;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface UseWebRTCCallOpts {
  callId: string | null;
  enabled: boolean;
}

export function useWebRTCCall({ callId, enabled }: UseWebRTCCallOpts) {
  const { user } = useAuth();
  const myId = user?.id ?? null;

  const [status, setStatus] = useState<CallConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [peers, setPeers] = useState<Record<string, RemotePeer>>({});
  const [isMuted, setMuted] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const startedRef = useRef(false);

  const updatePeer = useCallback((id: string, patch: Partial<RemotePeer>) => {
    setPeers((prev) => ({
      ...prev,
      [id]: { user_id: id, stream: null, connectionState: "new", ...prev[id], ...patch },
    }));
  }, []);

  const removePeer = useCallback((id: string) => {
    setPeers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    const pc = pcsRef.current[id];
    if (pc) {
      pc.close();
      delete pcsRef.current[id];
    }
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      const local = localStreamRef.current;
      if (local) local.getTracks().forEach((t) => pc.addTrack(t, local));

      pc.onicecandidate = (ev) => {
        if (ev.candidate && channelRef.current && myId) {
          channelRef.current.send({
            type: "broadcast",
            event: "ice",
            payload: { from: myId, to: peerId, candidate: ev.candidate.toJSON() },
          });
        }
      };

      pc.ontrack = (ev) => {
        const [stream] = ev.streams;
        updatePeer(peerId, { stream });
      };

      pc.onconnectionstatechange = () => {
        updatePeer(peerId, { connectionState: pc.connectionState });
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          removePeer(peerId);
        }
      };

      pcsRef.current[peerId] = pc;
      updatePeer(peerId, { connectionState: pc.connectionState });
      return pc;
    },
    [myId, updatePeer, removePeer],
  );

  const refreshParticipants = useCallback(async () => {
    if (!callId) return;
    try {
      const list = await listCallParticipants(callId);
      setParticipants(list);
    } catch (e) {
      console.error("listCallParticipants", e);
    }
  }, [callId]);

  // Main lifecycle
  useEffect(() => {
    if (!enabled || !callId || !myId) return;
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    const start = async () => {
      try {
        setStatus("requesting-mic");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;

        setStatus("connecting");
        await joinCall(callId);
        await refreshParticipants();

        const channel = supabase.channel(`call:${callId}`, {
          config: { broadcast: { self: false } },
        });
        channelRef.current = channel;

        channel
          .on("broadcast", { event: "peer-join" }, async ({ payload }) => {
            const fromId: string = payload.user_id;
            if (!fromId || fromId === myId) return;
            // Smaller id creates the offer to avoid glare
            if (myId < fromId) {
              const pc = createPeerConnection(fromId);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              channel.send({
                type: "broadcast",
                event: "offer",
                payload: { from: myId, to: fromId, sdp: offer },
              });
            }
          })
          .on("broadcast", { event: "offer" }, async ({ payload }) => {
            if (payload.to !== myId) return;
            const fromId: string = payload.from;
            const pc = pcsRef.current[fromId] ?? createPeerConnection(fromId);
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({
              type: "broadcast",
              event: "answer",
              payload: { from: myId, to: fromId, sdp: answer },
            });
          })
          .on("broadcast", { event: "answer" }, async ({ payload }) => {
            if (payload.to !== myId) return;
            const pc = pcsRef.current[payload.from];
            if (pc && !pc.currentRemoteDescription) {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            }
          })
          .on("broadcast", { event: "ice" }, async ({ payload }) => {
            if (payload.to !== myId) return;
            const pc = pcsRef.current[payload.from];
            if (pc && payload.candidate) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
              } catch (e) {
                console.warn("addIceCandidate failed", e);
              }
            }
          })
          .on("broadcast", { event: "peer-leave" }, ({ payload }) => {
            removePeer(payload.user_id);
          })
          .subscribe(async (state) => {
            if (state === "SUBSCRIBED") {
              channel.send({
                type: "broadcast",
                event: "peer-join",
                payload: { user_id: myId },
              });
              setStatus("live");
            }
          });
      } catch (e) {
        if (cancelled) return;
        const err = e as Error;
        console.error("call start failed", err);
        setError(
          err.name === "NotAllowedError" || err.name === "SecurityError"
            ? "Autorisez l'accès au micro pour rejoindre l'appel."
            : err.message || "Connexion à l'appel impossible.",
        );
        setStatus("error");
      }
    };

    void start();

    return () => {
      cancelled = true;
    };
  }, [enabled, callId, myId, createPeerConnection, removePeer, refreshParticipants]);

  // Subscribe to participants table changes
  useEffect(() => {
    if (!enabled || !callId) return;
    const ch = subscribeCallParticipants(callId, () => {
      void refreshParticipants();
    });
    return () => {
      ch.unsubscribe();
    };
  }, [enabled, callId, refreshParticipants]);

  const leave = useCallback(async () => {
    const myId2 = myId;
    try {
      if (channelRef.current && myId2) {
        channelRef.current.send({
          type: "broadcast",
          event: "peer-leave",
          payload: { user_id: myId2 },
        });
      }
    } catch {
      /* ignore */
    }
    Object.values(pcsRef.current).forEach((pc) => pc.close());
    pcsRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (channelRef.current) {
      try {
        await supabase.removeChannel(channelRef.current);
      } catch {
        /* ignore */
      }
      channelRef.current = null;
    }
    setPeers({});
    setStatus("idle");
    startedRef.current = false;
    if (callId) {
      try {
        await leaveCall(callId);
      } catch (e) {
        console.warn("leaveCall failed", e);
      }
    }
  }, [callId, myId]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (startedRef.current) {
        void leave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = useCallback(async () => {
    const next = !isMuted;
    setMuted(next);
    const stream = localStreamRef.current;
    if (stream) stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    if (callId) {
      try {
        await setCallMute(callId, next);
      } catch (e) {
        console.warn("setCallMute", e);
      }
    }
  }, [isMuted, callId]);

  return {
    status,
    error,
    participants,
    peers,
    isMuted,
    toggleMute,
    leave,
  };
}