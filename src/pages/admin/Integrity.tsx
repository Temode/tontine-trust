import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCcw, ScrollText, Search } from "lucide-react";
import { toast } from "sonner";
import {
  explainContribution,
  listCycleOpenTurnChecks,
  listTontineAlerts,
  listTurnAssignmentAudit,
  resolveTontineAlert,
  type TontineAlert,
} from "@/lib/api/integrity";

const SEV_STYLES: Record<TontineAlert["severity"], string> = {
  critical: "bg-red-500/15 text-red-300 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  info: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

export default function AdminIntegrity() {
  const qc = useQueryClient();
  const [includeResolved, setIncludeResolved] = useState(false);
  const [groupFilter, setGroupFilter] = useState("");
  const [explainOpen, setExplainOpen] = useState<Record<string, unknown> | null>(null);

  const alertsQ = useQuery({
    queryKey: ["integrity", "alerts", includeResolved],
    queryFn: () => listTontineAlerts(includeResolved),
    refetchInterval: 15_000,
  });
  const checksQ = useQuery({
    queryKey: ["integrity", "checks"],
    queryFn: listCycleOpenTurnChecks,
  });
  const auditQ = useQuery({
    queryKey: ["integrity", "audit", groupFilter || null],
    queryFn: () => listTurnAssignmentAudit(groupFilter || undefined),
  });

  const resolveMut = useMutation({
    mutationFn: resolveTontineAlert,
    onSuccess: () => {
      toast.success("Alerte marquée comme traitée");
      qc.invalidateQueries({ queryKey: ["integrity", "alerts"] });
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  const explainMut = useMutation({
    mutationFn: explainContribution,
    onSuccess: (data) => setExplainOpen(data),
    onError: (e: Error) => toast.error("Explication indisponible", { description: e.message }),
  });

  const invariantFailures = useMemo(
    () => (checksQ.data ?? []).filter((c) => c.open_turns > 1),
    [checksQ.data],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-amber-300">Intégrité tontine</h1>
        <p className="mt-1 text-sm text-slate-400">
          Alertes automatiques, contrôle d'invariants et explication détaillée des affectations payeur/bénéficiaire.
        </p>
      </header>

      {/* Invariants */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          Invariant « un seul tour ouvert par cycle »
        </h2>
        {checksQ.isLoading ? (
          <p className="mt-2 text-xs text-slate-500">Chargement…</p>
        ) : invariantFailures.length === 0 ? (
          <p className="mt-2 text-xs text-emerald-400">
            Aucune violation détectée — chaque cycle a au plus 1 tour `collecting`.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-red-300">
            {invariantFailures.map((c) => (
              <li key={c.cycle_id}>
                Cycle #{c.cycle_number} (group {c.group_id.slice(0, 8)}…) :{" "}
                <strong>{c.open_turns}</strong> tours ouverts simultanément
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Alertes */}
      <section className="rounded-lg border border-slate-800 overflow-hidden">
        <header className="flex items-center justify-between bg-slate-900 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Alertes ({alertsQ.data?.length ?? 0})
          </h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={includeResolved}
                onChange={(e) => setIncludeResolved(e.target.checked)}
              />
              Inclure résolues
            </label>
            <button
              type="button"
              onClick={() => alertsQ.refetch()}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-700 px-2 text-xs text-slate-300 hover:bg-slate-800"
            >
              <RefreshCcw className="h-3 w-3" /> Rafraîchir
            </button>
          </div>
        </header>
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Gravité</th>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Message</th>
              <th className="px-3 py-2 text-left">Métadonnées</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {alertsQ.isLoading && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Chargement…</td></tr>
            )}
            {!alertsQ.isLoading && (alertsQ.data ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-emerald-400">Aucune alerte ouverte ✓</td></tr>
            )}
            {alertsQ.data?.map((a) => (
              <tr key={a.id} className="border-t border-slate-800 hover:bg-slate-900/50 align-top">
                <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">
                  {new Date(a.created_at).toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${SEV_STYLES[a.severity]}`}>
                    {a.severity}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-amber-300">{a.code}</td>
                <td className="px-3 py-2 text-xs text-slate-200">{a.message}</td>
                <td className="px-3 py-2 font-mono text-[10px] text-slate-500 max-w-xs truncate">
                  {a.metadata ? JSON.stringify(a.metadata) : "—"}
                </td>
                <td className="px-3 py-2 text-right space-x-2">
                  {a.contribution_id && (
                    <button
                      type="button"
                      onClick={() => explainMut.mutate(a.contribution_id!)}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-700 px-2 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      <Search className="h-3 w-3" /> Expliquer
                    </button>
                  )}
                  {!a.resolved_at && (
                    <button
                      type="button"
                      onClick={() => resolveMut.mutate(a.id)}
                      className="inline-flex h-7 items-center gap-1 rounded-md bg-amber-400 px-2 text-xs font-semibold text-slate-900 hover:bg-amber-300"
                    >
                      Marquer traité
                    </button>
                  )}
                  {a.resolved_at && (
                    <span className="text-[10px] text-emerald-400">Traitée</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Historique d'audit */}
      <section className="rounded-lg border border-slate-800 overflow-hidden">
        <header className="flex items-center justify-between bg-slate-900 px-4 py-3 gap-3">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-amber-400" />
            Historique tours / bénéficiaires / payeurs
          </h2>
          <input
            type="text"
            placeholder="Filtrer par group_id (UUID)"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value.trim())}
            className="h-7 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 placeholder:text-slate-600 w-72"
          />
        </header>
        <div className="max-h-[500px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Groupe</th>
                <th className="px-3 py-2 text-left">Cycle</th>
                <th className="px-3 py-2 text-left">Tour</th>
                <th className="px-3 py-2 text-left">Statut</th>
                <th className="px-3 py-2 text-left">Bénéficiaire</th>
                <th className="px-3 py-2 text-left">Payeur</th>
                <th className="px-3 py-2 text-left">Cotis.</th>
                <th className="px-3 py-2 text-left">Échéance</th>
                <th className="px-3 py-2 text-left">Drapeaux</th>
              </tr>
            </thead>
            <tbody>
              {auditQ.isLoading && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-500">Chargement…</td></tr>
              )}
              {auditQ.data?.map((r) => (
                <tr key={`${r.turn_id}-${r.contribution_id ?? "none"}`} className="border-t border-slate-800 hover:bg-slate-900/50">
                  <td className="px-3 py-2 text-xs text-slate-300">{r.group_name}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">#{r.cycle_number}</td>
                  <td className="px-3 py-2 text-xs text-slate-300">#{r.turn_number}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className={
                      r.turn_status === "collecting" ? "text-amber-300" :
                      r.turn_status === "paid" ? "text-emerald-400" :
                      "text-slate-400"
                    }>{r.turn_status}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-200">{r.beneficiary_name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-200">{r.payer_name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{r.contribution_status ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{r.due_date}</td>
                  <td className="px-3 py-2 text-[10px]">
                    {r.flag_payer_is_beneficiary && <span className="text-red-400 mr-1">⚠ payeur=bénéf</span>}
                    {r.flag_payer_not_active && <span className="text-red-400">⚠ non-membre</span>}
                    {!r.flag_payer_is_beneficiary && !r.flag_payer_not_active && r.payer_user_id && (
                      <span className="text-emerald-500">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal explication */}
      {explainOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setExplainOpen(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-amber-300">Explication de l'affectation</h3>
            <p className="mt-2 text-sm text-slate-200">
              {(explainOpen as { explanation?: string }).explanation}
            </p>
            <pre className="mt-3 max-h-96 overflow-auto rounded bg-slate-950 p-3 text-[10px] text-slate-300">
              {JSON.stringify(explainOpen, null, 2)}
            </pre>
            <button
              type="button"
              onClick={() => setExplainOpen(null)}
              className="mt-3 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-900"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}