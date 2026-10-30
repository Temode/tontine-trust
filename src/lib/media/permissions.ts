/**
 * Vérification des permissions micro/caméra avant de démarrer un appel.
 * On sonde réellement `getUserMedia` (seul moyen fiable cross-navigateur de
 * déclencher le prompt natif), puis on libère immédiatement les pistes :
 * LiveKit rouvrira ses propres pistes à la connexion.
 */
export type MediaPermissionFailure =
  | "insecure"
  | "unsupported"
  | "denied"
  | "notfound"
  | "busy"
  | "error";

export type MediaPermissionResult =
  | { ok: true; hasVideo: boolean }
  | { ok: false; reason: MediaPermissionFailure; message: string };

const MESSAGES: Record<MediaPermissionFailure, string> = {
  insecure:
    "Les appels nécessitent une connexion sécurisée (HTTPS). Ouvrez l'application via son adresse https.",
  unsupported:
    "Votre navigateur ne permet pas l'accès au micro. Essayez Chrome, Safari ou Firefox à jour.",
  denied:
    "L'accès au micro (et à la caméra) est bloqué. Autorisez-le dans les réglages du navigateur, puis relancez l'appel.",
  notfound:
    "Aucun micro n'a été détecté. Branchez un micro ou un casque, puis relancez l'appel.",
  busy:
    "Le micro ou la caméra est déjà utilisé par une autre application. Fermez-la puis relancez l'appel.",
  error: "Impossible d'accéder au micro. Vérifiez les autorisations puis réessayez.",
};

function classify(err: unknown): MediaPermissionFailure {
  const name = (err as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "notfound";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "error";
}

function release(stream: MediaStream) {
  stream.getTracks().forEach((t) => t.stop());
}

export async function ensureMediaPermissions(
  withVideo: boolean,
): Promise<MediaPermissionResult> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    const reason: MediaPermissionFailure =
      typeof window !== "undefined" && !window.isSecureContext ? "insecure" : "unsupported";
    return { ok: false, reason, message: MESSAGES[reason] };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo,
    });
    release(stream);
    return { ok: true, hasVideo: withVideo };
  } catch (err) {
    const reason = classify(err);
    // Caméra absente/occupée mais micro possible : on dégrade en appel vocal.
    if (withVideo && (reason === "notfound" || reason === "busy")) {
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        release(audioOnly);
        return { ok: true, hasVideo: false };
      } catch (audioErr) {
        const audioReason = classify(audioErr);
        return { ok: false, reason: audioReason, message: MESSAGES[audioReason] };
      }
    }
    return { ok: false, reason, message: MESSAGES[reason] };
  }
}
