import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { toast } from "sonner";

const SPEAKER_RE = /speaker|haut[- ]?parleur|loud/i;
const EARPIECE_RE = /earpiece|receiver|écouteur|ecouteur|headset|casque|headphone|airpod|bluetooth/i;

export type AudioOutputKind = "speaker" | "earpiece" | "other";

export function classifyOutput(label: string): AudioOutputKind {
  if (EARPIECE_RE.test(label)) return "earpiece";
  if (SPEAKER_RE.test(label)) return "speaker";
  return "other";
}

/**
 * Sélection et basculement de la sortie audio (haut-parleur / oreillette / casque).
 * À utiliser à l'intérieur d'un <LiveKitRoom>.
 */
export function useAudioOutput() {
  const room = useRoomContext();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const supported =
    typeof HTMLMediaElement !== "undefined" &&
    typeof (HTMLMediaElement.prototype as unknown as { setSinkId?: unknown }).setSinkId ===
      "function";

  useEffect(() => {
    const load = async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices(list.filter((d) => d.kind === "audiooutput"));
      } catch {
        /* ignore */
      }
    };
    void load();
    navigator.mediaDevices?.addEventListener?.("devicechange", load);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", load);
  }, []);

  const select = useCallback(
    async (deviceId: string) => {
      try {
        await room?.switchActiveDevice("audiooutput", deviceId);
        setCurrentId(deviceId);
        toast.success("Sortie audio changée");
      } catch (e) {
        toast.error("Impossible de changer la sortie", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [room],
  );

  const currentKind: AudioOutputKind = useMemo(() => {
    const d = devices.find((x) => x.deviceId === currentId) ?? devices[0];
    return d ? classifyOutput(d.label) : "other";
  }, [devices, currentId]);

  /** Bascule rapide haut-parleur <-> oreillette/casque. */
  const toggleSpeaker = useCallback(async () => {
    const wantSpeaker = currentKind !== "speaker";
    const target =
      devices.find((d) =>
        wantSpeaker ? classifyOutput(d.label) === "speaker" : classifyOutput(d.label) === "earpiece",
      ) ?? devices.find((d) => d.deviceId !== currentId);
    if (!target) {
      toast("Aucune autre sortie audio disponible");
      return;
    }
    await select(target.deviceId);
  }, [currentKind, currentId, devices, select]);

  return { supported, devices, currentId, currentKind, select, toggleSpeaker };
}
