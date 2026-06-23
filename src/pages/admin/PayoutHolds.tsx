import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw, Send, Lock } from "lucide-react";
import {
  adminListPayoutHolds,
  adminResendPayoutHoldNotice,
  type AdminPayoutHoldRow,
} from "@/lib/api/holdPayouts";
import { formatGNF } from "@/lib/format";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPayoutHolds() {
  const qc = useQueryClient();
  const [onlyActive, setOnlyActive] = useState(false);

  const q = useQuery({
    queryKey: ["admin-payout-holds", onlyActive],
    queryFn: () => adminListPayoutHolds(onlyActive),
  });

  const resendM = useMutation({
    mutationFn: (turnId: string) => adminResendPayoutHoldNotice(turnId),
    onSuccess: (sent) => {
      if (sent) {
        toast.success("Notification renvoyée", {
          description: "Le bénéficiaire a été notifié (in-app + SMS).",
        });
      } else {
        toast.info("Aucun envoi nécessaire", {
          description: "Ce tour n'a pas de rétention majorée.",
        });
      }
      qc.invalidateQueries({ queryKey: ["admin-payout-holds"] });
    },
    onError: (e) => toast.error("Échec du renvoi", { description: (e as Error).message }),
  });

  const rows: AdminPayoutHoldRow[] = q.data ?? [];

  return (
    <div className="p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-amber-300">Rétentions de payout</h1>
          <p className="text-sm text-slate-400">
            Tours dont la libération est repoussée — historique des retards et renvoi de notification.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              className="h-4 w-4"
            />
            En cours uniquement
          </label>
          <button
            type="button"
            onClick={() => q.refetch()}
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Rafraîchir
          </button>
        </div>
      </header>

      {q.isLoading ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
          Aucun tour sous rétention.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/70 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Groupe / tour</th>
                <th className="px-3 py-2 text-left">Bénéficiaire</th>
                <th className="px-3 py-2 text-right">Montant</th>
                <th className="px-3 py-2 text-left">Payé le</th>
                <th className="px-3 py-2 text-left">Libération</th>
                <th className="px-3 py-2 text-left">Statut</th>
                <th className="px-3 py-2 text-left">Retards bénéficiaire</th>
                <th className="px-3 py-2 text-left">Notif</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {rows.map((r) => (
                <tr key={r.turn_id} className="hover:bg-slate-900/40">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.group_name ?? "—"}</div>
                    <div className="text-xs text-slate-400">Tour #{r.turn_number}</div>
                  </td>
                  <td className="px-3 py-2">{r.beneficiary_name ?? r.beneficiary_user_id.slice(0, 8)}</td>
                  <td className="px-3 py-2 text-right num">{formatGNF(r.payout_amount)} GNF</td>
                  <td className="px-3 py-2 text-xs">{fmt(r.paid_at)}</td>
                  <td className="px-3 py-2 text-xs">{fmt(r.payout_hold_until)}</td>
                  <td className="px-3 py-2">
                    {r.is_released ? (
                      <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        Libéré
                      </span>
                    ) : r.is_extended ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        <Lock className="h-3 w-3" /> Rétention majorée
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                        Standard
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.was_late_in_cycle ? (
                      <span>
                        Oui
                        {r.was_late_at_turn_number?.length
                          ? ` (tours: ${r.was_late_at_turn_number.join(", ")})`
                          : ""}
                      </span>
                    ) : (
                      <span className="text-slate-500">Non</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.notif_first_sent_at ? (
                      <div>
                        <div>Envoyée: {fmt(r.notif_first_sent_at)}</div>
                        {r.notif_resend_count > 0 && (
                          <div className="text-slate-400">
                            {r.notif_resend_count}× renvoyée — dernière: {fmt(r.notif_last_sent_at)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500">Pas encore</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.is_extended && !r.is_released ? (
                      <button
                        type="button"
                        onClick={() => resendM.mutate(r.turn_id)}
                        disabled={resendM.isPending}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                      >
                        <Send className="h-3 w-3" />
                        Renvoyer la notif
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}