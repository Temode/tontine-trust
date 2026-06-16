import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAdminPayments } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";

const STATUSES = ["all", "initiated", "pending", "succeeded", "failed", "cancelled", "refunded"];

export default function AdminPayments() {
  const [status, setStatus] = useState("all");
  const q = useQuery({ queryKey: ["admin-payments", status], queryFn: () => listAdminPayments(status) });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant="outline"
            className={`h-7 px-3 text-xs border-slate-700 ${status === s ? "bg-amber-500/10 text-amber-300" : "bg-transparent text-slate-300"} hover:bg-slate-800`}
            onClick={() => setStatus(s)}
          >
            {s}
          </Button>
        ))}
      </div>
      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Groupe</th>
              <th className="text-left px-3 py-2">Payeur</th>
              <th className="text-left px-3 py-2">Montant</th>
              <th className="text-left px-3 py-2">Méthode</th>
              <th className="text-left px-3 py-2">Statut</th>
              <th className="text-left px-3 py-2">Ref Djomy</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Chargement…</td></tr>}
            {q.data?.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Aucun paiement</td></tr>}
            {q.data?.map((p) => (
              <tr key={p.id} className="border-t border-slate-800 hover:bg-slate-900/50">
                <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{p.initiated_at ? new Date(p.initiated_at).toLocaleString("fr-FR") : "—"}</td>
                <td className="px-3 py-2 text-slate-300">{p.group_name ?? "—"}</td>
                <td className="px-3 py-2 text-slate-300">{p.payer_name ?? "—"}</td>
                <td className="px-3 py-2 text-slate-300">{Intl.NumberFormat("fr-FR").format(p.amount)} XOF</td>
                <td className="px-3 py-2 text-slate-300">{p.payment_method ?? p.provider ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${
                    p.status === "succeeded" ? "bg-emerald-500/15 text-emerald-300" :
                    p.status === "failed" ? "bg-red-500/15 text-red-300" :
                    "bg-slate-800 text-slate-300"}`}>{p.status}</span>
                </td>
                <td className="px-3 py-2 text-slate-500 text-xs font-mono">{p.djomy_transaction_id ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}