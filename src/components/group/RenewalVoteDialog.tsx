import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ShieldCheck, Users } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatGNF } from "@/lib/format";
import { getGroupTerms } from "@/lib/api/terms";
import { TermsAcceptStep } from "@/components/legal/TermsAcceptStep";
import type { RenewalStatus } from "@/lib/api/renewal";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  status: RenewalStatus;
  isPending: boolean;
  onConfirm: () => void;
}

/**
 * Parcours de confirmation de participation pour un membre :
 * 1) détail du cycle proposé, 2) acceptation des conditions (sautée si déjà faite).
 */
export function RenewalVoteDialog({
  open, onOpenChange, groupId, status, isPending, onConfirm,
}: Props) {
  const [step, setStep] = useState<"detail" | "terms">("detail");

  const termsQ = useQuery({
    queryKey: ["group-terms", groupId],
    queryFn: () => getGroupTerms(groupId),
    enabled: open && !!groupId,
  });
  const alreadyAccepted = termsQ.data?.accepted === true;

  useEffect(() => {
    if (open) setStep("detail");
  }, [open]);

  const deadline = status.deadline
    ? new Date(status.deadline).toLocaleDateString("fr-FR", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "detail" ? "Détail du nouveau cycle" : "Conditions de Tontine Digitale"}
          </DialogTitle>
          <DialogDescription>
            {step === "detail"
              ? "Vérifiez les conditions du cycle avant de confirmer votre participation."
              : "Acceptez les conditions une seule fois : elles resteront valables pour ce groupe."}
          </DialogDescription>
        </DialogHeader>

        {step === "detail" ? (
          <>
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-hairline bg-card p-3">
              <Field label="Cotisation par tour" value={formatGNF(status.contribution_amount ?? 0, { withCurrency: true })} />
              <Field label="Fréquence" value={status.frequency ?? "—"} />
              <Field label="Pot projeté" value={formatGNF(status.projected_payout ?? 0, { withCurrency: true })} />
              <Field label="Tours prévus" value={`${status.projected_turns ?? status.accepted ?? 0}`} />
            </div>

            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Seuil de viabilité : {status.min_members ?? 2} participants confirmés.
                Aujourd'hui : {status.accepted ?? 0} sur {status.eligible ?? 0}.
              </li>
              <li className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Date limite de réponse : {deadline}.
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Aucun prélèvement immédiat. Le cycle ne démarre qu'après validation de
                l'organisateur, et votre réponse reste modifiable jusqu'à la date limite.
              </li>
            </ul>

            {alreadyAccepted && (
              <p className="rounded-lg border border-hairline bg-secondary/40 p-2.5 text-[11px] text-muted-foreground">
                Vous avez déjà accepté les conditions de ce groupe (version {termsQ.data?.version}).
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button
                disabled={isPending || termsQ.isLoading}
                onClick={() => (alreadyAccepted ? onConfirm() : setStep("terms"))}
              >
                {isPending
                  ? "Enregistrement…"
                  : alreadyAccepted
                    ? "Confirmer ma participation"
                    : "Continuer"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <TermsAcceptStep
            groupId={groupId}
            ctaLabel="J'accepte et je participe"
            onAccepted={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-sm font-bold text-foreground num">{value}</p>
    </div>
  );
}
