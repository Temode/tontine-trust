import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import {
  adminListDeposits,
  adminForceDepositStatus,
  refundDeposit,
  forfeitDeposit,
  type AdminDepositRow,
} from "@/lib/api/deposits";
import { formatGNF } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  paid: "Validé",
  failed: "Échec",
  cancelled: "Annulé",
  refunded: "Remboursé",
  forfeited: "Saisi",
};

const STATUS_FILTERS: Array<{ key: string; label: string; status: AdminDepositRow["status"] | null }> = [
  { key: "all", label: "Tous", status: null },
  { key: "pending", label: "En attente", status: "pending" },
  { key: "paid", label: "Validés", status: "paid" },
  { key: "failed", label: "Échecs", status: "failed" },
  { key: "refunded", label: "Remboursés", status: "refunded" },
  { key: "forfeited", label: "Saisis", status: "forfeited" },
];

export default function AdminDeposits() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>(STATUS_FILTERS[0]);
  const [forceFor, setForceFor] = useState<AdminDepositRow | null>(null);
  const [forceStatus, setForceStatus] = useState<"paid" | "failed" | "cancelled" | "pending">("paid");
  const [reason, setReason] = useState("");

  const q = useQuery({
    queryKey: ["admin-deposits", filter.key],
    queryFn: () => adminListDeposits({ status: filter.status }),
  });

  const forceM = useMutation({
    mutationFn: () => {
      if (!forceFor) return Promise.reject(new Error("NO_DEPOSIT"));
      if (reason.trim().length < 10) return Promise.reject(new Error("Motif ≥ 10 caractères"));
      return adminForceDepositStatus(forceFor.deposit_id, forceStatus, reason.trim());
    },
    onSuccess: () => {
      toast.success("Caution régularisée", { description: "L'action a été journalisée." });
      qc.invalidateQueries({ queryKey: ["admin-deposits"] });
      setForceFor(null);
      setReason("");
    },
    onError: (e) => toast.error("Échec", { description: (e as Error).message }),
  });

  const refundM = useMutation({
    mutationFn: (id: string) => refundDeposit(id, "Remboursement admin"),
    onSuccess: () => {
      toast.success("Caution remboursée");
      qc.invalidateQueries({ queryKey: ["admin-deposits"] });
    },
    onError: (e) => toast.error("Remboursement impossible", { description: (e as Error).message }),
  });

  const forfeitM = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => forfeitDeposit(id, why),
    onSuccess: () => {
      toast.success("Caution saisie");
      qc.invalidateQueries({ queryKey: ["admin-deposits"] });
    },
    onError: (e) => toast.error("Saisie impossible", { description: (e as Error).message }),
  });

  return (
    <div className="p-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Cautions (dépôts membres)</h1>
          <p className="text-sm text-muted-foreground">
            Supervision des dépôts, régularisation manuelle et journal d'audit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => q.refetch()}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold"
        >
          <RefreshCw className="h-4 w-4" />
          Rafraîchir
        </button>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f)}
            className={`h-8 rounded-md px-3 text-xs font-semibold transition ${
              filter.key === f.key
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-foreground hover:bg-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {q.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      )}
      {q.error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {(q.error as Error).message}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Groupe</th>
              <th className="px-3 py-2 text-left">Membre</th>
              <th className="px-3 py-2 text-right">Montant</th>
              <th className="px-3 py-2 text-left">Statut</th>
              <th className="px-3 py-2 text-left">Djomy</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(q.data ?? []).map((d) => (
              <tr key={d.deposit_id} className="hover:bg-secondary/30">
                <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(d.created_at).toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2">
                  <div className="font-semibold">{d.group_name}</div>
                  <div className="text-[10px] text-muted-foreground">{d.group_id.slice(0, 8)}…</div>
                </td>
                <td className="px-3 py-2">
                  <div className="font-semibold">{d.user_full_name ?? "—"}</div>
                  <div className="text-[10px] text-muted-foreground num">{d.user_phone ?? ""}</div>
                </td>
                <td className="px-3 py-2 text-right num font-semibold">
                  {formatGNF(d.amount)} GNF
                  <div className="text-[10px] font-normal text-muted-foreground">
                    {d.months} mois
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      d.status === "paid"
                        ? "bg-emerald-100 text-emerald-800"
                        : d.status === "pending"
                        ? "bg-amber-100 text-amber-800"
                        : d.status === "failed" || d.status === "cancelled"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    {STATUS_LABEL[d.status] ?? d.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-[10px] text-muted-foreground">
                  {d.djomy_transaction_id ?? "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setForceFor(d);
                        setForceStatus(d.status === "paid" ? "failed" : "paid");
                        setReason("");
                      }}
                      className="rounded border border-border px-2 py-1 text-[11px] font-semibold hover:bg-secondary"
                    >
                      <ShieldAlert className="mr-1 inline h-3 w-3" />
                      Forcer
                    </button>
                    {d.status === "paid" && (
                      <>
                        <button
                          type="button"
                          disabled={refundM.isPending}
                          onClick={() => refundM.mutate(d.deposit_id)}
                          className="rounded border border-emerald-300 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          Rembourser
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const why = window.prompt(
                              "Motif de saisie (≥ 10 caractères) :",
                              "",
                            );
                            if (why && why.trim().length >= 10) {
                              forfeitM.mutate({ id: d.deposit_id, why: why.trim() });
                            } else if (why) {
                              toast.error("Motif trop court");
                            }
                          }}
                          className="rounded border border-destructive/40 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/10"
                        >
                          Saisir
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(q.data ?? []).length === 0 && !q.isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Aucun dépôt pour ce filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {forceFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-5 shadow-xl">
            <h2 className="font-display text-lg font-bold">Forcer la régularisation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {forceFor.user_full_name ?? "Membre"} — {forceFor.group_name}
            </p>
            <label className="mt-4 block text-xs font-semibold uppercase text-muted-foreground">
              Nouveau statut
            </label>
            <select
              value={forceStatus}
              onChange={(e) => setForceStatus(e.target.value as typeof forceStatus)}
              className="mt-1 h-10 w-full rounded-md border border-border bg-card px-2 text-sm"
            >
              <option value="paid">Validé (paid)</option>
              <option value="pending">En attente</option>
              <option value="failed">Échec</option>
              <option value="cancelled">Annulé</option>
            </select>
            <label className="mt-4 block text-xs font-semibold uppercase text-muted-foreground">
              Motif (≥ 10 caractères, journalisé)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-card p-2 text-sm"
              placeholder="Ex. Paiement reçu par virement bancaire vérifié manuellement"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setForceFor(null)}
                className="rounded border border-border px-3 py-2 text-sm font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={forceM.isPending || reason.trim().length < 10}
                onClick={() => forceM.mutate()}
                className="rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {forceM.isPending ? "…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}