import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertOctagon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { reportDefaulter } from "@/lib/api/defaulters";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contributionId: string;
  payerName: string;
  groupId: string;
}

export function ReportDefaulterDialog({ open, onOpenChange, contributionId, payerName, groupId }: Props) {
  const [reason, setReason] = useState("");
  const qc = useQueryClient();

  const m = useMutation({
    mutationFn: () => reportDefaulter(contributionId, reason.trim()),
    onSuccess: () => {
      toast.success("Signalement transmis à l'équipe Tontine", {
        description: "Un agent prendra contact avec le membre.",
      });
      qc.invalidateQueries({ queryKey: ["group-defaulters", groupId] });
      onOpenChange(false);
      setReason("");
    },
    onError: (e: Error) => {
      const map: Record<string, string> = {
        FORBIDDEN: "Vous n'avez pas la permission de signaler un défaillant.",
        REPORT_ALREADY_OPEN: "Un signalement est déjà ouvert pour cette cotisation.",
        CONTRIBUTION_NOT_DEFAULTED: "Cette cotisation n'est pas en défaut.",
      };
      toast.error("Signalement impossible", { description: map[e.message] ?? e.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertOctagon className="h-5 w-5 text-destructive" />
            Signaler à l'équipe Tontine
          </DialogTitle>
          <DialogDescription>
            Vous allez signaler officiellement <strong>{payerName}</strong>. L'équipe Tontine
            prendra contact directement avec le membre (appel, mise en demeure, voie judiciaire si nécessaire)
            sur la base de son dossier KYC. Ce signalement est tracé et notifié au membre.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="reason" className="text-sm font-medium">Motif détaillé</label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex : Le membre a reçu sa part au tour 1 puis a cessé de cotiser. Aucun contact depuis 8 jours."
            rows={5}
            maxLength={1000}
          />
          <p className="text-[11px] text-muted-foreground">{reason.length}/1000 caractères</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={m.isPending}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={() => m.mutate()}
            disabled={m.isPending || reason.trim().length < 10}
          >
            {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertOctagon className="h-4 w-4" />}
            Signaler officiellement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}