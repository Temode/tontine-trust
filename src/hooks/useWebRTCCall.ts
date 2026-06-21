import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchIceServers,
  joinCall,
  leaveCall,
  listCallParticipants,
  setCallMute,
  setCallRecording,
  subscribeCallParticipants,
  uploadCallRecording,
  type CallParticipant,
} from "@/lib/api/calls";

export type CallConnectionStatus = "idle" | "requesting-mic" | "connecting" | "live" | "error";

export interface RemotePeer {
  user_id: string;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  iceConnectionState?: RTCIceConnectionState;
  signalingState?: RTCSignalingState;
  retries?: number;
  lastError?: string | null;
}

export interface WebRTCDiagEvent {
  ts: number;
  peer?: string;
  type:
    | "ice"
    | "ice-state"
    | "conn-state"
    | "signaling"
    | "offer"
    | "answer"
    | "retry"
    | "error"
    | "info";
  detail?: string;
}

const FALLBACK_ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

interface UseWebRTCCallOpts {
  callId: string | null;
  enabled: boolean;
  groupId?: string;
  recordingEnabled?: boolean;
  video?: boolean;
  initialMuted?: boolean;
  initialCamOff?: boolean;
  initialScreenShare?: boolean;
}

export function useWebRTCCall({
  callId,
  enabled,
  groupId,
  recordingEnabled,
  video = true,
  initialMuted = false,
  initialCamOff = false,
  initialScreenShare = false,
}: UseWebRTCCallOpts) {
  const { user } = useAuth();
  const myId = user?.id ?? null;

  const [status, setStatus] = useState<CallConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [peers, setPeers] = useState<Record<string, RemotePeer>>({});
  const [isMuted, setMuted] = useState(initialMuted);
  const [isCamOff, setCamOff] = useState(initialCamOff);
  const [isScreenSharing, setScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [turnAvailable, setTurnAvailable] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [diagEvents, setDiagEvents] = useState<WebRTCDiagEvent[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenAutoStartedRef = useRef(false);
  const participantsRef = useRef<CallParticipant[]>([]);
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const startedRef = useRef(false);
  const iceServersRef = useRef<RTCIceServer[]>(FALLBACK_ICE);
  const usedRelayRef = useRef<Set<string>>(new Set());
  const retryCountRef = useRef<Record<string, number>>({});
  const retryTimersRef = useRef<Record<string, number>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const mixedStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const logDiag = useCallback((ev: Omit<WebRTCDiagEvent, "ts">) => {
    setDiagEvents((prev) => {
      const next = [...prev, { ts: Date.now(), ...ev }];
      return next.length > 150 ? next.slice(-150) : next;
    });
  }, []);

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
    const t = retryTimersRef.current[id];
    if (t) {
      window.clearTimeout(t);
      delete retryTimersRef.current[id];
    }
  }, []);

  // Forward decls via refs (mutual recursion: createPeerConnection -> scheduleRetry -> rebuildPeer -> createPeerConnection)
  const scheduleRetryRef = useRef<(peerId: string, reason: string) => void>(() => {});

  const createPeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      const relay = usedRelayRef.current.has(peerId);
      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
        iceTransportPolicy: relay ? "relay" : "all",
      });

      const local = localStreamRef.current;
      if (local) local.getTracks().forEach((t) => pc.addTrack(t, local));

      pc.onicecandidate = (ev) => {
        if (ev.candidate && channelRef.current && myId) {
          channelRef.current.send({
            type: "broadcast",
            event: "ice",
            payload: { from: myId, to: peerId, candidate: ev.candidate.toJSON() },
          });
          logDiag({ peer: peerId, type: "ice", detail: ev.candidate.type ?? "candidate" });
        }
      };

      pc.ontrack = (ev) => {
        const [stream] = ev.streams;
        updatePeer(peerId, { stream });
        logDiag({ peer: peerId, type: "info", detail: `track ${ev.track.kind}` });
        if (audioCtxRef.current && mixedStreamRef.current) {
          try {
            const ctx = audioCtxRef.current;
            const src = ctx.createMediaStreamSource(stream);
            const dest = (mixedStreamRef.current as MediaStream & {
              _dest?: MediaStreamAudioDestinationNode;
            })._dest;
            if (dest) src.connect(dest);
          } catch (e) {
            console.warn("mix remote stream failed", e);
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        updatePeer(peerId, { iceConnectionState: pc.iceConnectionState });
        logDiag({ peer: peerId, type: "ice-state", detail: pc.iceConnectionState });
        if (pc.iceConnectionState === "failed") {
          scheduleRetryRef.current(peerId, "ice-failed");
        }
      };
      pc.onsignalingstatechange = () => {
        updatePeer(peerId, { signalingState: pc.signalingState });
        logDiag({ peer: peerId, type: "signaling", detail: pc.signalingState });
      };

      pc.onconnectionstatechange = () => {
        updatePeer(peerId, { connectionState: pc.connectionState });
        logDiag({ peer: peerId, type: "conn-state", detail: pc.connectionState });
        if (pc.connectionState === "failed") {
          scheduleRetryRef.current(peerId, "conn-failed");
        } else if (pc.connectionState === "closed") {
          removePeer(peerId);
        }
      };

      pcsRef.current[peerId] = pc;
      updatePeer(peerId, {
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        signalingState: pc.signalingState,
        retries: retryCountRef.current[peerId] ?? 0,
        lastError: null,
      });
      return pc;
    },
    [myId, updatePeer, removePeer, logDiag],
  );

  const rebuildPeer = useCallback(
    async (peerId: string) => {
      const old = pcsRef.current[peerId];
      if (old) {
        try {
          old.close();
        } catch {
          /* ignore */
        }
        delete pcsRef.current[peerId];
      }
      if (!myId) return;
      const pc = createPeerConnection(peerId);
      if (myId < peerId && channelRef.current) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channelRef.current.send({
            type: "broadcast",
            event: "offer",
            payload: { from: myId, to: peerId, sdp: offer },
          });
          logDiag({ peer: peerId, type: "offer", detail: "rebuild" });
        } catch (e) {
          logDiag({ peer: peerId, type: "error", detail: (e as Error).message });
        }
      }
    },
    [createPeerConnection, myId, logDiag],
  );

  const scheduleRetry = useCallback(
    (peerId: string, reason: string) => {
      if (retryTimersRef.current[peerId]) return;
      const attempt = (retryCountRef.current[peerId] ?? 0) + 1;
      if (attempt > MAX_RETRIES) {
        if (turnAvailable && !usedRelayRef.current.has(peerId)) {
          usedRelayRef.current.add(peerId);
          retryCountRef.current[peerId] = 0;
          logDiag({ peer: peerId, type: "retry", detail: "switch to TURN-only" });
          void rebuildPeer(peerId);
          return;
        }
        updatePeer(peerId, { lastError: `Échec après ${MAX_RETRIES} tentatives (${reason})` });
        logDiag({ peer: peerId, type: "error", detail: `give up after ${MAX_RETRIES} (${reason})` });
        removePeer(peerId);
        return;
      }
      retryCountRef.current[peerId] = attempt;
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 4000;
      logDiag({
        peer: peerId,
        type: "retry",
        detail: `attempt ${attempt}/${MAX_RETRIES} in ${delay}ms (${reason})`,
      });
      updatePeer(peerId, { retries: attempt });
      retryTimersRef.current[peerId] = window.setTimeout(async () => {
        delete retryTimersRef.current[peerId];
        const pc = pcsRef.current[peerId];
        if (!pc || !channelRef.current || !myId) return;
        try {
          if (myId < peerId) {
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            channelRef.current.send({
              type: "broadcast",
              event: "offer",
              payload: { from: myId, to: peerId, sdp: offer, restart: true },
            });
            logDiag({ peer: peerId, type: "offer", detail: "iceRestart" });
          } else {
            channelRef.current.send({
              type: "broadcast",
              event: "need-restart",
              payload: { from: myId, to: peerId },
            });
          }
        } catch (e) {
          logDiag({ peer: peerId, type: "error", detail: (e as Error).message });
        }
      }, delay);
    },
    [myId, logDiag, removePeer, updatePeer, turnAvailable, rebuildPeer],
  );

  // Wire ref so createPeerConnection (created earlier) can call latest scheduleRetry.
  useEffect(() => {
    scheduleRetryRef.current = scheduleRetry;
  }, [scheduleRetry]);

  const refreshParticipants = useCallback(async () => {
    if (!callId) return;
    try {
      const list = await listCallParticipants(callId);
        participantsRef.current = list;
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
        const constraints: MediaStreamConstraints = {
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: video
            ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
            : false,
        };
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
          if (video) {
            logDiag({ type: "info", detail: "video failed, fallback audio-only" });
            stream = await navigator.mediaDevices.getUserMedia({ audio: constraints.audio });
          } else {
            throw e;
          }
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !initialMuted;
        });
        stream.getVideoTracks().forEach((track) => {
          track.enabled = !initialCamOff;
        });
        setMuted(initialMuted);
        setCamOff(initialCamOff || stream.getVideoTracks().length === 0);
        setLocalStream(stream);
        logDiag({
          type: "info",
          detail: `local stream ready (${stream.getTracks().map((t) => t.kind).join("+")})`,
        });

        setStatus("connecting");
        try {
          const ice = await fetchIceServers();
          iceServersRef.current = ice.iceServers.length ? ice.iceServers : FALLBACK_ICE;
          setTurnAvailable(ice.turn);
          logDiag({
            type: "info",
            detail: `ICE servers: ${ice.iceServers.length} (TURN=${ice.turn})`,
          });
        } catch {
          iceServersRef.current = FALLBACK_ICE;
          logDiag({ type: "error", detail: "fetchIceServers failed, fallback STUN" });
        }
        await joinCall(callId);
        if (initialMuted) {
          try {
            await setCallMute(callId, true);
          } catch (e) {
            console.warn("set initial mute", e);
          }
        }
        await refreshParticipants();

        const channel = supabase.channel(`call:${callId}`, {
          config: { broadcast: { self: false } },
        });
        channelRef.current = channel;

        channel
          .on("broadcast", { event: "peer-join" }, async ({ payload }) => {
            const fromId: string = payload.user_id;
            if (!fromId || fromId === myId) return;
            logDiag({ peer: fromId, type: "info", detail: "peer-join" });
            if (myId < fromId) {
              const pc = createPeerConnection(fromId);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              channel.send({
                type: "broadcast",
                event: "offer",
                payload: { from: myId, to: fromId, sdp: offer },
              });
              logDiag({ peer: fromId, type: "offer", detail: "initial" });
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
            logDiag({
              peer: fromId,
              type: "answer",
              detail: payload.restart ? "iceRestart" : "initial",
            });
          })
          .on("broadcast", { event: "answer" }, async ({ payload }) => {
            if (payload.to !== myId) return;
            const pc = pcsRef.current[payload.from];
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              logDiag({ peer: payload.from, type: "info", detail: "remote answer set" });
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
                logDiag({
                  peer: payload.from,
                  type: "error",
                  detail: `addIceCandidate: ${(e as Error).message}`,
                });
              }
            }
          })
          .on("broadcast", { event: "need-restart" }, async ({ payload }) => {
            if (payload.to !== myId) return;
            const fromId = payload.from as string;
            const pc = pcsRef.current[fromId];
            if (!pc) return;
            try {
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              channel.send({
                type: "broadcast",
                event: "offer",
                payload: { from: myId, to: fromId, sdp: offer, restart: true },
              });
              logDiag({ peer: fromId, type: "offer", detail: "iceRestart (asked)" });
            } catch (e) {
              logDiag({ peer: fromId, type: "error", detail: (e as Error).message });
            }
          })
          .on("broadcast", { event: "peer-leave" }, ({ payload }) => {
            removePeer(payload.user_id);
            logDiag({ peer: payload.user_id, type: "info", detail: "peer-leave" });
          })
          .subscribe(async (state) => {
            if (state === "SUBSCRIBED") {
              const announce = () =>
                channel.send({
                  type: "broadcast",
                  event: "peer-join",
                  payload: { user_id: myId },
                });
              // Re-broadcast a few times to defeat race conditions where a peer
              // is still wiring its own listeners when we first announce.
              announce();
              window.setTimeout(announce, 800);
              window.setTimeout(announce, 2500);
              window.setTimeout(() => {
                void refreshParticipants();
                announce();
              }, 5000);
              const activePeers = participantsRef.current
                .filter((p) => !p.left_at && p.user_id !== myId)
                .map((p) => p.user_id);
              for (const peerId of activePeers) {
                if (myId >= peerId || pcsRef.current[peerId]) continue;
                try {
                  const pc = createPeerConnection(peerId);
                  const offer = await pc.createOffer();
                  await pc.setLocalDescription(offer);
                  channel.send({
                    type: "broadcast",
                    event: "offer",
                    payload: { from: myId, to: peerId, sdp: offer },
                  });
                  logDiag({ peer: peerId, type: "offer", detail: "existing-peer" });
                } catch (e) {
                  logDiag({ peer: peerId, type: "error", detail: (e as Error).message });
                }
              }
              setStatus("live");
              logDiag({ type: "info", detail: "signaling channel subscribed" });
            }
          });
      } catch (e) {
        if (cancelled) return;
        const err = e as Error;
        console.error("call start failed", err);
        const friendly =
          err.name === "NotAllowedError" || err.name === "SecurityError"
            ? "Autorisez l'accès au micro et à la caméra pour rejoindre l'appel."
            : err.name === "NotFoundError"
              ? "Aucun micro ou caméra détecté."
              : err.name === "NotReadableError"
                ? "Le micro/caméra est déjà utilisé par une autre application."
                : err.message || "Connexion à l'appel impossible.";
        setError(friendly);
        logDiag({ type: "error", detail: `start: ${err.name}: ${err.message}` });
        setStatus("error");
      }
    };

    void start();

    return () => {
      cancelled = true;
    };
  }, [enabled, callId, myId, createPeerConnection, removePeer, refreshParticipants, video, initialMuted, initialCamOff, logDiag]);

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
    Object.values(retryTimersRef.current).forEach((t) => window.clearTimeout(t));
    retryTimersRef.current = {};
    retryCountRef.current = {};
    Object.values(pcsRef.current).forEach((pc) => pc.close());
    pcsRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
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

  const toggleCam = useCallback(() => {
    const next = !isCamOff;
    setCamOff(next);
    const stream = localStreamRef.current;
    if (stream) stream.getVideoTracks().forEach((t) => (t.enabled = !next));
  }, [isCamOff]);

  const stopScreenShare = useCallback(async () => {
    const stream = localStreamRef.current;
    const screen = screenStreamRef.current;
    if (!stream || !screen) {
      setScreenSharing(false);
      return;
    }
    const camTrack = cameraTrackRef.current;
    // Replace screen track with original camera track in every sender
    Object.values(pcsRef.current).forEach((pc) => {
      pc.getSenders().forEach((s) => {
        if (s.track && s.track.kind === "video") {
          void s.replaceTrack(camTrack ?? null);
        }
      });
    });
    // Update local stream
    screen.getTracks().forEach((t) => {
      stream.removeTrack(t);
      t.stop();
    });
    if (camTrack && !stream.getVideoTracks().includes(camTrack)) {
      stream.addTrack(camTrack);
      camTrack.enabled = !isCamOff;
    }
    screenStreamRef.current = null;
    cameraTrackRef.current = null;
    setLocalStream(new MediaStream(stream.getTracks()));
    setScreenSharing(false);
    logDiag({ type: "info", detail: "screen share stopped" });
  }, [isCamOff, logDiag]);

  const startScreenShare = useCallback(async () => {
    if (screenStreamRef.current) return;
    const stream = localStreamRef.current;
    if (!stream) throw new Error("Flux local non prêt.");
    let screen: MediaStream;
    try {
      screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
      });
    } catch (e) {
      const err = e as DOMException;
      logDiag({ type: "error", detail: `screen share: ${err.name}` });
      throw e;
    }
    const screenTrack = screen.getVideoTracks()[0];
    if (!screenTrack) throw new Error("Aucune piste vidéo dans le partage d'écran.");
    // Save current camera track and remove from stream
    const existingCam = stream.getVideoTracks()[0] ?? null;
    cameraTrackRef.current = existingCam;
    if (existingCam) stream.removeTrack(existingCam);
    stream.addTrack(screenTrack);
    screenStreamRef.current = screen;
    // Replace track in every peer connection — no re-negotiation needed
    Object.values(pcsRef.current).forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        void sender.replaceTrack(screenTrack);
      } else {
        pc.addTrack(screenTrack, stream);
      }
    });
    screenTrack.onended = () => {
      void stopScreenShare();
    };
    setLocalStream(new MediaStream(stream.getTracks()));
    setScreenSharing(true);
    logDiag({ type: "info", detail: "screen share started" });
  }, [logDiag, stopScreenShare]);

  const toggleScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [startScreenShare, stopScreenShare]);

  // Auto-start screen share once the call is live if requested pre-call.
  useEffect(() => {
    if (
      status === "live" &&
      initialScreenShare &&
      !screenAutoStartedRef.current &&
      !screenStreamRef.current
    ) {
      screenAutoStartedRef.current = true;
      startScreenShare().catch((e) => {
        console.warn("auto screen-share failed", e);
      });
    }
  }, [status, initialScreenShare, startScreenShare]);

  const startRecording = useCallback(async () => {
    if (recorderRef.current) return;
    const local = localStreamRef.current;
    if (!local) throw new Error("Aucun flux local actif.");
    if (typeof MediaRecorder === "undefined") {
      throw new Error("Votre navigateur ne supporte pas l'enregistrement.");
    }
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    if (local.getAudioTracks().length > 0) {
      ctx.createMediaStreamSource(new MediaStream(local.getAudioTracks())).connect(dest);
    }
    Object.values(peers).forEach((p) => {
      if (p.stream) ctx.createMediaStreamSource(p.stream).connect(dest);
    });
    audioCtxRef.current = ctx;
    const mixed = dest.stream as MediaStream & { _dest?: MediaStreamAudioDestinationNode };
    mixed._dest = dest;
    mixedStreamRef.current = mixed;
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/webm";
    const rec = new MediaRecorder(mixed, { mimeType });
    recordedChunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    rec.start(1000);
    recordStartRef.current = Date.now();
    recorderRef.current = rec;
    setIsRecording(true);
  }, [peers]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    const rec = recorderRef.current;
    if (!rec) return null;
    return new Promise((resolve) => {
      rec.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: rec.mimeType });
        const duration = Math.round((Date.now() - recordStartRef.current) / 1000);
        recordedChunksRef.current = [];
        recorderRef.current = null;
        if (audioCtxRef.current) {
          try {
            await audioCtxRef.current.close();
          } catch {
            /* ignore */
          }
          audioCtxRef.current = null;
        }
        mixedStreamRef.current = null;
        setIsRecording(false);
        if (groupId && callId && blob.size > 0) {
          try {
            const { signedUrl } = await uploadCallRecording(groupId, callId, blob);
            await setCallRecording(callId, signedUrl, blob.size, duration);
          } catch (e) {
            console.error("upload recording failed", e);
          }
        }
        resolve(blob);
      };
      rec.stop();
    });
  }, [groupId, callId]);

  useEffect(() => {
    if (status === "live" && recordingEnabled && !recorderRef.current) {
      void startRecording().catch((e) => console.warn("auto-record", e));
    }
  }, [status, recordingEnabled, startRecording]);

  const leaveWithStop = useCallback(async () => {
    if (recorderRef.current) {
      try {
        await stopRecording();
      } catch {
        /* ignore */
      }
    }
    await leave();
  }, [leave, stopRecording]);

  return {
    status,
    error,
    participants,
    peers,
    isMuted,
    toggleMute,
    isCamOff,
    toggleCam,
    isScreenSharing,
    toggleScreenShare,
    leave: leaveWithStop,
    isRecording,
    startRecording,
    stopRecording,
    turnAvailable,
    localStream,
    diagEvents,
  };
}
