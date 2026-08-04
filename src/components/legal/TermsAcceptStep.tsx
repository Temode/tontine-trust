import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { acceptGroupTerms, getGroupTerms } from "@/lib/api/terms";

interface Props {
  groupId: string;
  /** Appelé une fois l'acceptation enregistrée (ou si elle existait déjà). */
  onAccepted: () => void;
  /** Libellé du bouton de validation. */
  ctaLabel?: string;
}

/**
 * Étape unique d'acceptation des conditions générales d'utilisation et de
 * protection des données. Aucune signature par code SMS : une case à cocher.
 */
export function TermsAcceptStep({ groupId, onAccepted, ctaLabel = "J'accepte et je continue" }: Props) {
  const qc = useQueryClient();
  const [checked, setChecked] = useState(false);

  const termsQ = useQuery({
    queryKey: ["group-terms", groupId],
    queryFn: () => getGroupTerms(groupId),
    enabled: !!groupId,
  });

  const m = useMutation({
    mutationFn: () => acceptGroupTerms(groupId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["group-terms", groupId] });
      onAccepted();
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  if (termsQ.isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Chargement des conditions…</p>;
  }
  if (termsQ.error || !termsQ.data) {
    return (
      <p className="py-6 text-center text-sm text-destructive">
        Impossible de charger les conditions générales.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-hairline bg-secondary/40 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          Version {termsQ.data.version} · votre acceptation est horodatée et conservée comme preuve
          de consentement. Aucun code SMS n'est demandé.
        </span>
      </div>

      <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-hairline bg-card p-4 text-sm leading-relaxed text-foreground">
        {termsQ.data.content}
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => setChecked(v === true)}
          className="mt-0.5"
        />
        <span>
          J'ai lu et j'accepte les conditions générales d'utilisation et la politique de protection
          des données de Tontine Digitale.
        </span>
      </label>

      <Button className="w-full" disabled={!checked || m.isPending} onClick={() => m.mutate()}>
        {m.isPending ? "Enregistrement…" : ctaLabel}
      </Button>
    </div>
  );
}
