import { Info } from "lucide-react";
import { formatGNF } from "@/lib/format";
import type { DbContributionDue } from "@/lib/api/contributions";

/**
 * Détail dépliable de la pénalité de retard + explication du score de fiabilité.
 */
export function PenaltyBreakdown({ due }: { due: DbContributionDue }) {
  const pct = due.late_penalty_percent ?? 0;
  const afterDays = due.late_penalty_after_days ?? 0;
  const daysLate = due.default_days ?? Math.max(0, -due.days_to_due);
  const estimated =
    pct > 0 && daysLate > afterDays
      ? Math.round((due.amount * pct) / 100)
      : 0;

  return (
    <details className="group rounded-lg border border-destructive/30 bg-destructive/5 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 font-semibold text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1 focus-visible:rounded-md">
        <span className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Détail de la pénalité de retard
        </span>
        <span className="text-[11px] font-normal text-muted-foreground group-open:hidden">Voir</span>
        <span className="hidden text-[11px] font-normal text-muted-foreground group-open:inline">Masquer</span>
      </summary>
      <div className="space-y-3 border-t border-destructive/20 px-3 py-3">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <dt className="text-muted-foreground">Pourcentage appliqué</dt>
          <dd className="text-right font-mono font-semibold text-foreground">{pct}%</dd>
          <dt className="text-muted-foreground">Jours de tolérance</dt>
          <dd className="text-right font-mono font-semibold text-foreground">{afterDays} j</dd>
          <dt className="text-muted-foreground">Jours de retard retenus</dt>
          <dd className="text-right font-mono font-semibold text-destructive">{daysLate} j</dd>
          <dt className="text-muted-foreground">Montant estimé</dt>
          <dd className="text-right font-mono font-bold text-destructive">
            {formatGNF(estimated)} GNF
          </dd>
        </dl>
        <div className="rounded-md border border-hairline bg-card p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">Comment se calcule votre score de fiabilité ?</p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>85% : ratio cotisations payées sur cotisations dues.</li>
            <li>15% : ratio paiements à temps.</li>
            <li>−15 points par cotisation en défaut active.</li>
            <li>30% de bonus social en fonction des avis reçus (si ≥1 avis).</li>
            <li>Paliers : excellent ≥ 85 · bon ≥ 70 · moyen ≥ 50 · risque sinon.</li>
            <li className="font-semibold text-destructive">
              ≥ 2 défauts ou 1 procédure judiciaire → compte bloqué.
            </li>
          </ul>
        </div>
      </div>
    </details>
  );
}