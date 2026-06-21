import { useEffect, useState } from "react";
import { Mic, ShieldCheck } from "lucide-react";

interface Props {
  onGranted: () => void;
  onCancel: () => void;
}

const LS_KEY = "tontine.mic.granted";

export function MicPermissionGate({ onGranted, onCancel }: Props) {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Skip if we know the user already granted before (best-effort hint, not auth).
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem(LS_KEY) === "1") {
      onGranted();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const request = async () => {
    setRequesting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      window.localStorage.setItem(LS_KEY, "1");
      onGranted();
    } catch (e) {
      const err = e as DOMException;
      if (err.name === "NotAllowedError") {
        setError(
          "Vous avez refusé l'accès au micro. Ouvrez les paramètres de votre navigateur (verrou à gauche de l'URL) pour autoriser cette page, puis réessayez.",
        );
      } else if (err.name === "NotFoundError") {
        setError("Aucun micro détecté sur cet appareil.");
      } else if (err.name === "NotReadableError") {
        setError("Un autre logiciel utilise déjà le micro. Fermez-le et réessayez.");
      } else {
        setError(err.message || "Impossible d'accéder au micro.");
      }
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Mic className="h-7 w-7 text-primary" />
      </div>
      <h2 className="font-display text-lg font-bold text-foreground">
        Autorisez votre micro
      </h2>
      <p className="text-sm text-muted-foreground">
        Pour rejoindre cet appel, Tontine Digital a besoin d'accéder à votre micro.
        Aucun son n'est diffusé ou enregistré sans votre accord explicite.
      </p>
      <ul className="w-full space-y-2 rounded-lg border border-hairline bg-card p-4 text-left text-xs text-muted-foreground">
        <li className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          Le micro n'est activé que pendant cet appel.
        </li>
        <li className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          Vous pouvez le couper à tout moment depuis la barre de contrôle.
        </li>
        <li className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          L'enregistrement est désactivé par défaut et requiert l'accord de tous.
        </li>
      </ul>

      {error && (
        <div className="w-full rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex w-full gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 rounded-md border border-hairline text-sm font-semibold text-foreground hover:bg-secondary"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={request}
          disabled={requesting}
          className="h-11 flex-1 rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-primary hover:bg-primary-700 disabled:opacity-50"
        >
          {requesting ? "Demande…" : "Autoriser le micro"}
        </button>
      </div>
    </div>
  );
}