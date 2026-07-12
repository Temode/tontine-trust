import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  adminListWithdrawals,
  adminMarkWithdrawalPaid,
  adminRejectWithdrawal,
  CHANNEL_LABEL,
  formatDestination,
  type AdminWithdrawalRow,
  type UserWithdrawalStatus,
} from "@/lib/api/wallet";
import { formatGNF } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS: { id: UserWithdrawalStatus | "all"; label: string }[] = [
  { id: "pending", label: "En attente" },
  { id: "completed", label: "Traitées" },
  { id: "rejected", label: "Rejetées" },
  { id: "all", label: "Toutes" },
];

export default function AdminWithdrawals() {
  const [tab, setTab] = useState<UserWithdrawalStatus | "all">("pending");
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-withdrawals", tab],
    queryFn: () => adminListWithdrawals(tab === "all" ? undefined : tab),
  });

  const rows = q.data ?? [];

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-amber-300">Gestion des retraits</h1>
        <p className="mt-1 text-sm text-slate-400">
          Traitez les demandes de retrait des utilisateurs. Effectuez le virement en externe, puis marquez la demande comme payée.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-semibold transition",
              tab === t.id
                ? "bg-amber-400 text-slate-900"
                : "border border-slate-700 text-slate-300 hover:bg-slate-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-400">
              <Th>Date</Th>
              <Th>Utilisateur</Th>
              <Th>Contact</Th>
              <Th className="text-right">Montant</Th>
              <Th>Méthode</Th>
              <Th>Destination</Th>
              <Th>Statut</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-500">Aucune demande dans cet onglet.</td></tr>
            ) : (
              rows.map((r) => <Row key={r.id} row={r} onDone={() => qc.invalidateQueries({ queryKey: ["admin-withdrawals"] })} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2 font-semibold", className)}>{children}</th>;
}

function Row({ row, onDone }: { row: AdminWithdrawalRow; onDone: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const payMut = useMutation({
    mutationFn: () => adminMarkWithdrawalPaid(row.id),
    onSuccess: () => { toast.success("Marquée comme payée. Notification envoyée à l'utilisateur."); onDone(); },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  const rejectMut = useMutation({
    mutationFn: () => adminRejectWithdrawal(row.id, reason),
    onSuccess: () => { toast.success("Demande rejetée."); onDone(); setRejecting(false); setReason(""); },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  const statusColor =
    row.status === "pending" ? "bg-amber-500/20 text-amber-300"
    : row.status === "completed" ? "bg-emerald-500/20 text-emerald-300"
    : "bg-red-500/20 text-red-300";

  return (
    <>
      <tr className="border-b border-slate-800/50 text-slate-200 hover:bg-slate-800/30">
        <td className="px-3 py-2 text-xs">
          {new Date(row.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </td>
        <td className="px-3 py-2 font-semibold">{row.full_name ?? "—"}</td>
        <td className="px-3 py-2 text-xs text-slate-400">{row.phone_number ?? "—"}</td>
        <td className="px-3 py-2 text-right font-mono font-bold text-amber-300">{formatGNF(row.amount)} GNF</td>
        <td className="px-3 py-2 text-xs">{CHANNEL_LABEL[row.payment_method]}</td>
        <td className="px-3 py-2 text-xs">{formatDestination(row.payment_method, row.payment_details)}</td>
        <td className="px-3 py-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", statusColor)}>
            {row.status === "pending" ? "En attente" : row.status === "completed" ? "Payée" : "Rejetée"}
          </span>
        </td>
        <td className="px-3 py-2 text-right">
          {row.status === "pending" && (
            <div className="flex justify-end gap-2">
              <button
                onClick={() => payMut.mutate()}
                disabled={payMut.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3 w-3" />
                Marquer comme payé
              </button>
              <button
                onClick={() => setRejecting((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10"
              >
                <XCircle className="h-3 w-3" />
                Rejeter
              </button>
            </div>
          )}
          {row.status === "rejected" && row.rejection_reason && (
            <span className="text-xs italic text-slate-500">Motif : {row.rejection_reason}</span>
          )}
        </td>
      </tr>
      {rejecting && (
        <tr className="border-b border-slate-800/50 bg-slate-900/80">
          <td colSpan={8} className="px-3 py-3">
            <div className="flex gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motif du rejet (obligatoire)"
                className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200"
              />
              <button
                disabled={!reason.trim() || rejectMut.isPending}
                onClick={() => rejectMut.mutate()}
                className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                Confirmer le rejet
              </button>
              <button
                onClick={() => { setRejecting(false); setReason(""); }}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
              >
                Annuler
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}