import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Scale } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { raiseDispute } from "@/lib/api/disputes";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contributionId: string;
  groupName: string;
}

export function DisputeDialog({ open, onOpenChange, contributionId, groupName }: Props) {
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const qc = useQueryClient();

  const m = useMutation({
    mutationFn: () => raiseDispute({
      contributionId,
      reason: reason.trim(),
      evidenceUrl: evidence.trim() || null,
    }),
    onSuccess: () => {
      toast.success("Contestation envoyée", {
        description: "L'organisateur du groupe va examiner votre demande.",
      });
      qc.invalidateQueries({ queryKey: ["my-disputes"] });
      qc.invalidateQueries({ queryKey: ["user-default-history"] });
      onOpenChange(false);
      setReason("");
      setEvidence("");
    },
    onError: (e: Error) => {
      const map: Record<string, string> = {
        REASON_TOO_SHORT: "Le motif doit faire au moins 5 caractères.",
        DISPUTE_ALREADY_OPEN: "Vous avez déjà une contestation en cours pour cette cotisation.",
        FORBIDDEN: "Action non autorisée.",
      };
      toast.error("Impossible d'envoyer", { description: map[e.message] ?? e.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Contester / demander une revue
          </DialogTitle>
          <DialogDescription>
            Tontine pour <strong>{groupName}</strong>. Expliquez à l'organisateur pourquoi cette
            cotisation devrait être revue. Vous pouvez joindre un lien vers une preuve
            (capture, reçu, attestation).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="dispute-reason" className="text-sm font-medium">
              Motif détaillé <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="dispute-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex : J'ai effectué le virement le 12, voici le justificatif. Le délai bancaire explique le retard."
              rows={5}
              maxLength={1000}
            />
            <p className="text-[11px] text-muted-foreground">{reason.length}/1000</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dispute-evidence" className="text-sm font-medium">
              Lien vers une preuve (optionnel)
            </label>
            <Input
              id="dispute-evidence"
              type="url"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={m.isPending}>
            Annuler
          </Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || reason.trim().length < 5}>
            {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
            Envoyer la contestation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}