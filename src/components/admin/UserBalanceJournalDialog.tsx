import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { fetchUserBalanceJournal, withRunningBalance } from "@/lib/api/reconciliation";
import { formatGNF } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  ledger: "Grand livre groupe",
  withdrawal: "Retrait",
  platform: "Plateforme / frais",
  audit: "Action admin",
};

const DIR_STYLE: Record<string, string> = {
  in: "text-emerald-300",
  out: "text-red-300",
  hold: "text-amber-300",
  info: "text-slate-400",
};

export function UserBalanceJournalDialog({
  userId,
  userName,
  onClose,
}: {
  userId: string;
  userName?: string | null;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["balance-journal", userId],
    queryFn: () => fetchUserBalanceJournal(userId),
  });

  const rows = withRunningBalance(q.data ?? []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-amber-300">Journal des mouvements de solde</h3>
            <p className="text-xs text-slate-400">{userName ?? userId}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-auto">
          {q.isLoading ? (
            <p className="p-4 text-xs text-slate-500">Chargement…</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">Aucun mouvement enregistré.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Écriture</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                  <th className="px-3 py-2 text-right">Cumul</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {rows.map((r, i) => (
                  <tr key={`${r.reference ?? "x"}-${i}`}>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-400">
                      {new Date(r.occurred_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2">{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td className="px-3 py-2">
                      {r.label}
                      {r.metadata?.rejection_reason ? (
                        <span className="text-slate-500"> · {String(r.metadata.rejection_reason)}</span>
                      ) : null}
                      {typeof r.metadata?.fee_amount === "number" && r.metadata.fee_amount > 0 ? (
                        <span className="text-slate-500"> · frais {formatGNF(Number(r.metadata.fee_amount))}</span>
                      ) : null}
                    </td>
                    <td className={cn("px-3 py-2 text-right font-medium", DIR_STYLE[r.direction])}>
                      {r.direction === "out" ? "-" : r.direction === "in" ? "+" : ""}
                      {formatGNF(Number(r.amount))}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400">{formatGNF(r.running_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserBalanceJournalDialog;
