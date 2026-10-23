import { Camera, Mic, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MediaPermissionFailure } from "@/lib/media/permissions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reason: MediaPermissionFailure | null;
  message: string;
  withVideo: boolean;
  onRetry: () => void;
  retrying?: boolean;
}

const HELP: Partial<Record<MediaPermissionFailure, string[]>> = {
  denied: [
    "Cliquez sur l'icône de cadenas (ou de caméra) à gauche de l'adresse.",
    "Passez le micro — et la caméra pour un appel vidéo — sur « Autoriser ».",
    "Rechargez la page si le navigateur le demande, puis relancez l'appel.",
  ],
  notfound: [
    "Branchez un micro, un casque ou des écouteurs.",
    "Vérifiez qu'il est bien sélectionné dans les réglages son du système.",
  ],
  busy: [
    "Fermez les autres applications d'appel (Zoom, Meet, WhatsApp…).",
    "Fermez les autres onglets qui utilisent le micro ou la caméra.",
  ],
};

export function MediaPermissionPrompt({
  open,
  onOpenChange,
  reason,
  message,
  withVideo,
  onRetry,
  retrying,
}: Props) {
  const steps = (reason && HELP[reason]) ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-testid="media-permission-prompt">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Autorisation requise
          </DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-md bg-secondary p-3 text-xs text-muted-foreground">
          <Mic className="h-4 w-4 shrink-0" />
          <span>Micro</span>
          {withVideo && (
            <>
              <Camera className="ml-2 h-4 w-4 shrink-0" />
              <span>Caméra</span>
            </>
          )}
        </div>

        {steps.length > 0 && (
          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 flex-1 rounded-md border border-hairline text-xs font-semibold text-foreground hover:bg-secondary"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            data-testid="media-permission-retry"
            className="h-10 flex-1 rounded-md bg-primary text-xs font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-50"
          >
            {retrying ? "Vérification…" : "Réessayer"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
