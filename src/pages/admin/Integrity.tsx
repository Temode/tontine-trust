import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCcw, ScrollText, Search } from "lucide-react";
import { toast } from "sonner";
import {
  explainContribution,
  listCycleOpenTurnChecks,
  listTontineAlerts,
  listTurnAssignmentAudit,
  listWithdrawalConsistency,
  resolveTontineAlert,
  type TontineAlert,
} from "@/lib/api/integrity";
import {
  FINDING_LABEL,
  fetchReconciliationSummary,
  listReconciliationFindings,
  resolveReconciliationFinding,
  runReconciliation,
} from "@/lib/api/reconciliation";
import { UserBalanceJournalDialog } from "@/components/admin/UserBalanceJournalDialog";
import { formatGNF } from "@/lib/format";

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
  const [journalUser, setJournalUser] = useState<{ id: string; name: string | null } | null>(null);
  const [showResolved, setShowResolved] = useState(false);

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
  const withdrawalCheckQ = useQuery({
    queryKey: ["integrity", "withdrawal-consistency"],
    queryFn: listWithdrawalConsistency,
  });
  const reconSummaryQ = useQuery({
    queryKey: ["reconciliation", "summary"],
    queryFn: fetchReconciliationSummary,
  });
  const findingsQ = useQuery({
    queryKey: ["reconciliation", "findings", showResolved],
    queryFn: () => listReconciliationFindings(!showResolved),
  });

  const runMut = useMutation({
    mutationFn: runReconciliation,
    onSuccess: () => {
      toast.success("Réconciliation exécutée");
      qc.invalidateQueries({ queryKey: ["reconciliation"] });
      qc.invalidateQueries({ queryKey: ["integrity", "withdrawal-consistency"] });
    },
    onError: (e: Error) => toast.error("Échec du contrôle", { description: e.message }),
  });

  const resolveFindingMut = useMutation({
    mutationFn: (id: string) => resolveReconciliationFinding(id, "Traité depuis l'admin"),
    onSuccess: () => {
      toast.success("Écart clôturé");
      qc.invalidateQueries({ queryKey: ["reconciliation"] });
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
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
      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Réconciliation périodique soldes calculés vs comptables
          </h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={showResolved}
                onChange={(e) => setShowResolved(e.target.checked)}
              />
              Inclure clôturés
            </label>
            <button
              type="button"
              onClick={() => runMut.mutate()}
              disabled={runMut.isPending}
              className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCcw className="mr-1 inline h-3 w-3" />
              Lancer un contrôle
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Contrôle automatique quotidien (03h15) · dernier passage :{" "}
          {reconSummaryQ.data?.last_run_at
            ? new Date(reconSummaryQ.data.last_run_at).toLocaleString("fr-FR")
            : "jamais"}
        </p>
        {findingsQ.isLoading ? (
          <p className="mt-2 text-xs text-slate-500">Chargement…</p>
        ) : (findingsQ.data?.length ?? 0) === 0 ? (
          <p className="mt-2 text-xs text-emerald-400">
            Aucun écart ouvert — soldes calculés et écritures comptables alignés.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {findingsQ.data?.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs"
              >
                <div>
                  <strong className={f.severity === "critical" ? "text-red-300" : "text-amber-300"}>
                    {FINDING_LABEL[f.code] ?? f.code}
                  </strong>
                  <span className="text-slate-400">
                    {" "}· {f.full_name ?? f.user_id.slice(0, 8)} · attendu {formatGNF(f.expected_amount)} /
                    constaté {formatGNF(f.actual_amount)} · écart{" "}
                    <strong className="text-red-300">{formatGNF(f.delta)}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setJournalUser({ id: f.user_id, name: f.full_name })}
                    className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"
                  >
                    <ScrollText className="mr-1 inline h-3 w-3" />
                    Journal
                  </button>
                  {!f.resolved_at && (
                    <button
                      type="button"
                      onClick={() => resolveFindingMut.mutate(f.id)}
                      className="rounded border border-emerald-700 px-2 py-1 text-emerald-300 hover:bg-emerald-900/30"
                    >
                      Clôturer
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          Cohérence « total retiré » vs retraits traités
        </h2>
        {withdrawalCheckQ.isLoading ? (
          <p className="mt-2 text-xs text-slate-500">Chargement…</p>
        ) : (withdrawalCheckQ.data?.length ?? 0) === 0 ? (
          <p className="mt-2 text-xs text-emerald-400">
            Aucune divergence — chaque membre a un total retiré égal à ses demandes traitées.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-red-300">
            {withdrawalCheckQ.data?.map((r) => (
              <li key={r.user_id}>
                {r.full_name ?? r.user_id.slice(0, 8)} : soldes {Intl.NumberFormat("fr-FR").format(r.balances_withdrawn)} GNF
                {" "}vs demandes traitées {Intl.NumberFormat("fr-FR").format(r.completed_requests)} GNF
                {" "}(écart <strong>{Intl.NumberFormat("fr-FR").format(r.delta)}</strong>)
                {" "}
                <button
                  type="button"
                  onClick={() => setJournalUser({ id: r.user_id, name: r.full_name })}
                  className="underline hover:text-red-200"
                >
                  voir le journal
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

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
      {journalUser && (
        <UserBalanceJournalDialog
          userId={journalUser.id}
          userName={journalUser.name}
          onClose={() => setJournalUser(null)}
        />
      )}

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