import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listGroupProofs, confirmExternalPayment, rejectExternalPayment,
  EXTERNAL_METHOD_LABEL,
} from "@/lib/api/externalPayments";
import { formatXof } from "@/lib/format";

interface Props { groupId: string }

export function ExternalPaymentsPanel({ groupId }: Props) {
  const qc = useQueryClient();
  const { data: proofs = [], isLoading } = useQuery({
    queryKey: ["external-proofs", groupId, "pending"],
    queryFn: () => listGroupProofs(groupId, "pending"),
  });

  const confirmM = useMutation({
    mutationFn: (id: string) => confirmExternalPayment(id),
    onSuccess: () => {
      toast.success("Paiement confirmé");
      qc.invalidateQueries({ queryKey: ["external-proofs", groupId] });
      qc.invalidateQueries({ queryKey: ["group-payments-history", groupId] });
    },
    onError: (e: Error) => toast.error("Échec confirmation", { description: e.message }),
  });

  const rejectM = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectExternalPayment(id, reason),
    onSuccess: () => {
      toast.success("Preuve refusée");
      qc.invalidateQueries({ queryKey: ["external-proofs", groupId] });
    },
    onError: (e: Error) => toast.error("Échec refus", { description: e.message }),
  });

  const rows = useMemo(() => proofs, [proofs]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Aucune preuve en attente.</p>;

  return (
    <ul className="space-y-2">
      {rows.map((p) => (
        <li key={p.id} className="rounded-md border border-hairline p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">{formatXof(p.amount)} · {EXTERNAL_METHOD_LABEL[p.method]}</p>
              {p.reference && <p className="text-xs text-muted-foreground">Réf : {p.reference}</p>}
              {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => confirmM.mutate(p.id)} disabled={confirmM.isPending}>
                <Check className="mr-1 h-3 w-3" /> Valider
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const reason = window.prompt("Motif du refus ?") || "";
                  if (reason !== null) rejectM.mutate({ id: p.id, reason });
                }}
                disabled={rejectM.isPending}
              >
                <X className="mr-1 h-3 w-3" /> Refuser
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}