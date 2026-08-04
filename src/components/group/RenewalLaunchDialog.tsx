import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatGNF } from "@/lib/format";
import { openCycleRenewal } from "@/lib/api/renewal";
import { getGroupTerms } from "@/lib/api/terms";
import { TermsAcceptStep } from "@/components/legal/TermsAcceptStep";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  previousMembers: number;
  eligible: number;
  contribution: number;
  onDone: () => void;
}

const DELAYS = [3, 7, 14];

export function RenewalLaunchDialog({
  open, onOpenChange, groupId, previousMembers, eligible, contribution, onDone,
}: Props) {
  const [minMembers, setMinMembers] = useState(Math.max(2, Math.min(previousMembers, eligible)));
  const [days, setDays] = useState(7);
  const [customDate, setCustomDate] = useState("");
  const [step, setStep] = useState<"terms" | "settings">("terms");

  const termsQ = useQuery({
    queryKey: ["group-terms", groupId],
    queryFn: () => getGroupTerms(groupId),
    enabled: open && !!groupId,
  });

  // Étape 1 sautée automatiquement si les conditions en vigueur sont déjà acceptées.
  useEffect(() => {
    if (!open) return;
    if (termsQ.data) setStep(termsQ.data.accepted ? "settings" : "terms");
  }, [open, termsQ.data]);

  const deadline = customDate
    ? new Date(`${customDate}T23:59:00`)
    : new Date(Date.now() + days * 86_400_000);

  const m = useMutation({
    mutationFn: () => openCycleRenewal(groupId, minMembers, deadline.toISOString()),
    onSuccess: () => {
      toast.success("Demande de relance envoyée aux membres");
      onOpenChange(false);
      onDone();
    },
    onError: (e: Error) => toast.error("Relance impossible", { description: e.message }),
  });

  const invalid =
    minMembers < 2 || minMembers > eligible || Number.isNaN(deadline.getTime()) || deadline <= new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "terms" ? "Conditions générales et protection des données" : "Demande de relance"}
          </DialogTitle>
          <DialogDescription>
            {step === "terms"
              ? "Étape 1 sur 2 — acceptez les conditions pour préparer la relance du cycle."
              : "Étape 2 sur 2 — chaque membre recevra une notification et devra confirmer sa participation. Rien n'est reconduit automatiquement."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
          <span className={step === "terms" ? "text-primary" : "text-muted-foreground"}>1 Conditions</span>
          <span className="text-muted-foreground">·</span>
          <span className={step === "settings" ? "text-primary" : "text-muted-foreground"}>2 Relance</span>
        </div>

        {step === "terms" ? (
          <div className="py-2">
            <TermsAcceptStep
              groupId={groupId}
              ctaLabel="J'accepte et je continue"
              onAccepted={() => setStep("settings")}
            />
          </div>
        ) : (
        <>
        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="min-members">Participants minimum pour lancer le cycle</Label>
            <Input
              id="min-members"
              type="number"
              min={2}
              max={eligible}
              value={minMembers}
              onChange={(e) => setMinMembers(Number(e.target.value))}
            />
            <p className="text-[11px] text-muted-foreground">
              Entre 2 et {eligible} · pot estimé au seuil :{" "}
              {formatGNF(contribution * Math.max(minMembers, 0), { withCurrency: true })} par tour
            </p>
          </div>

          <div className="space-y-2">
            <Label>Date limite de réponse</Label>
            <div className="flex flex-wrap gap-2">
              {DELAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDays(d);
                    setCustomDate("");
                  }}
                  className={`h-9 rounded-lg border px-3 text-xs font-semibold transition ${
                    !customDate && days === d
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-hairline text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d} jours
                </button>
              ))}
              <Input
                type="date"
                className="h-9 w-auto"
                value={customDate}
                min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Réponses attendues avant le {deadline.toLocaleDateString("fr-FR")}.
            </p>
          </div>

          <div className="rounded-lg border border-hairline bg-secondary/40 p-3 text-[11px] text-muted-foreground">
            Le pot de chaque tour est recalculé selon le nombre réel de participants confirmés, et
            l'ordre de rotation est entièrement régénéré au démarrage.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => m.mutate()} disabled={invalid || m.isPending}>
            {m.isPending ? "Envoi…" : "Envoyer la demande"}
          </Button>
        </DialogFooter>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}