import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Download, Receipt as ReceiptIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listGroupPaymentsHistory } from "@/lib/api/paymentsHistory";
import { downloadCsv } from "@/lib/export/csv";
import { formatGNF } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { PaymentDetailsDialog } from "@/components/payment/PaymentDetailsDialog";
import { cn } from "@/lib/utils";

interface Props { groupId: string }

function fmtDateTime(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    confirmed: "bg-success/10 text-success",
    pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    overdue: "bg-destructive/10 text-destructive",
  };
  const label: Record<string, string> = {
    confirmed: "Payé",
    pending: "En attente",
    overdue: "En retard",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", map[status] ?? "bg-muted text-muted-foreground")}>
      {label[status] ?? status}
    </span>
  );
}

export function PaymentsHistoryPanel({ groupId }: Props) {
  const qc = useQueryClient();
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["group-payments-history", groupId],
    queryFn: () => listGroupPaymentsHistory(groupId),
  });

  // Realtime : MAJ instantanée dès qu'un paiement/contribution change pour ce groupe
  useEffect(() => {
    const channel = supabase
      .channel(`group-history-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments", filter: `group_id=eq.${groupId}` },
        () => qc.invalidateQueries({ queryKey: ["group-payments-history", groupId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contributions", filter: `group_id=eq.${groupId}` },
        () => qc.invalidateQueries({ queryKey: ["group-payments-history", groupId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, qc]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Aucun paiement.</p>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCsv(`paiements-${groupId.slice(0, 8)}.csv`, rows as unknown as Array<Record<string, unknown>>)}
        >
          <Download className="mr-2 h-4 w-4" /> Exporter CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">Tour</th>
              <th>Payeur</th>
              <th>Montant</th>
              <th>Confirmé le</th>
              <th>Méthode</th>
              <th>Statut</th>
              <th className="text-right">Reçu</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.contribution_id} className="border-b border-hairline/50 hover:bg-secondary/40">
                <td className="py-2">#{r.turn_number}</td>
                <td>{r.payer_name ?? "—"}</td>
                <td className="num">{formatGNF(r.amount)}</td>
                <td className="text-xs text-muted-foreground">{fmtDateTime(r.settled_at ?? r.confirmed_at)}</td>
                <td className="text-xs">{r.payment_method ?? r.provider ?? "—"}</td>
                <td>{statusBadge(r.contribution_status)}</td>
                <td className="text-right">
                  {r.payment_id ? (
                    <button
                      type="button"
                      onClick={() => setSelectedPayment(r.payment_id)}
                      className="inline-flex items-center gap-1 rounded-md border border-hairline px-2 py-1 text-xs font-medium hover:bg-secondary"
                    >
                      <ReceiptIcon className="h-3 w-3" /> Détails
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaymentDetailsDialog
        paymentId={selectedPayment}
        open={!!selectedPayment}
        onOpenChange={(v) => { if (!v) setSelectedPayment(null); }}
      />
    </div>
  );
}