import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listGroupPaymentsHistory } from "@/lib/api/paymentsHistory";
import { downloadCsv } from "@/lib/export/csv";
import { formatXof } from "@/lib/format";

interface Props { groupId: string }

export function PaymentsHistoryPanel({ groupId }: Props) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["group-payments-history", groupId],
    queryFn: () => listGroupPaymentsHistory(groupId),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Aucun paiement.</p>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCsv(`paiements-${groupId.slice(0, 8)}.csv`, rows)}
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
              <th>Échéance</th>
              <th>Montant</th>
              <th>Pénalité</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.contribution_id} className="border-b border-hairline/50">
                <td className="py-2">#{r.turn_number}</td>
                <td>{r.payer_name ?? "—"}</td>
                <td>{r.due_date}</td>
                <td>{formatXof(r.amount)}</td>
                <td>{r.penalty_amount > 0 ? formatXof(r.penalty_amount) : "—"}</td>
                <td>{r.contribution_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}