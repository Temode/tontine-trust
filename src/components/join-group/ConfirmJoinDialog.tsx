import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface ConfirmJoinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  submitting?: boolean;
  onConfirm: () => void;
}

/**
 * Lightweight consent gate before invoking `joinWithCode`. Mirrors the
 * SubscriptionDialog ethos but does not require directory metadata —
 * it just makes the user explicitly acknowledge they're joining.
 */
export function ConfirmJoinDialog({
  open,
  onOpenChange,
  code,
  submitting,
  onConfirm,
}: ConfirmJoinDialogProps) {
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (open) setConsent(false);
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 w-full overflow-hidden rounded-t-xl border-x border-t border-hairline bg-card shadow-2xl",
            "data-[state=open]:animate-slide-up data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
            "md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border",
            "md:data-[state=open]:animate-fade-in",
          )}
        >
          <header className="flex items-center justify-between border-b border-hairline px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Confirmation d'adhésion
              </p>
              <DialogPrimitive.Title className="font-display text-base font-bold text-foreground">
                Rejoindre cette tontine
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              aria-label="Fermer"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-hairline text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </header>

          <div className="space-y-4 p-5">
            <div className="rounded-lg border border-hairline bg-secondary/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Code d'invitation
              </p>
              <p className="mt-1 font-mono text-xl font-bold tracking-[0.18em] text-foreground num">
                {code}
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              En confirmant, vous demandez à rejoindre le groupe associé à ce code. L'organisateur recevra
              votre adhésion. Vous pourrez consulter les termes du contrat (cotisation, fréquence, règles)
              dans la page du groupe avant toute cotisation. Aucun débit n'est exécuté à cette étape.
            </p>

            <label
              htmlFor="confirm-join-consent"
              className="flex cursor-pointer items-start gap-3 rounded-md border border-hairline bg-card p-3"
            >
              <input
                id="confirm-join-consent"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span className="text-sm text-foreground">
                Je confirme vouloir rejoindre ce groupe et accepte que mon adhésion soit visible par
                l'organisateur.
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <DialogPrimitive.Close className="inline-flex h-10 items-center rounded-md border border-hairline bg-card px-4 text-sm font-medium text-foreground transition hover:bg-secondary">
                Annuler
              </DialogPrimitive.Close>
              <button
                type="button"
                onClick={onConfirm}
                disabled={!consent || submitting}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold transition",
                  consent && !submitting
                    ? "bg-primary text-primary-foreground hover:bg-primary-700"
                    : "cursor-not-allowed bg-muted text-muted-foreground",
                )}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Adhésion en cours…" : "Confirmer l'adhésion"}
              </button>
            </div>

            <p className="inline-flex items-start gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <span>
                Votre adhésion est horodatée. Vous pourrez quitter le groupe avant le démarrage du
                premier cycle.
              </span>
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}