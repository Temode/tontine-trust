import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchReconciliationSummary } from "@/lib/api/reconciliation";
import { formatGNF } from "@/lib/format";

/**
 * Bandeau d'alerte affiché dans /admin/retraits et /admin/comptabilite
 * lorsqu'un total retiré calculé ne correspond pas à l'historique des retraits traités.
 */
export function ReconciliationAlert({ compact = false }: { compact?: boolean }) {
  const q = useQuery({
    queryKey: ["reconciliation", "summary"],
    queryFn: fetchReconciliationSummary,
    refetchInterval: 60_000,
  });

  const s = q.data;
  if (q.isLoading || !s) return null;

  const lastRun = s.last_run_at
    ? new Date(s.last_run_at).toLocaleString("fr-FR")
    : "jamais exécutée";

  if (s.open_count === 0) {
    if (compact) return null;
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span>Réconciliation des soldes conforme — dernier contrôle : {lastRun}.</span>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
        <div className="text-xs text-red-200">
          <p className="font-semibold text-red-300">
            {s.open_count} écart{s.open_count > 1 ? "s" : ""} de solde détecté
            {s.open_count > 1 ? "s" : ""}
            {s.critical_count > 0 ? ` (dont ${s.critical_count} critique${s.critical_count > 1 ? "s" : ""})` : ""}
          </p>
          <p className="mt-1">
            {s.withdrawn_mismatch_count > 0 && (
              <>
                {s.withdrawn_mismatch_count} utilisateur
                {s.withdrawn_mismatch_count > 1 ? "s ont" : " a"} un total retiré différent de
                l'historique des retraits traités.{" "}
              </>
            )}
            Écart maximal : <strong>{formatGNF(s.max_abs_delta)}</strong> · dernier contrôle : {lastRun}.
          </p>
          <Link
            to="/admin/integrite"
            className="mt-2 inline-block rounded-md border border-red-400/40 px-2.5 py-1 font-medium text-red-200 hover:bg-red-500/20"
          >
            Analyser les écarts
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ReconciliationAlert;
