import { ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { formatGNF } from "@/lib/format";

interface PortfolioStats {
  total: number;
  active: number;
  yourTurn: number;
  completed: number;
  pending: number;
  capitalCommitted: number;
  cagnotteCumulee: number;
  avgScore: number;
  upcomingTurn: { amount: number; days: number; groupName: string } | null;
}

export function GroupsHero({ stats }: { stats: PortfolioStats }) {
  const hasUpcoming = stats.upcomingTurn !== null;

  return (
    <section
      aria-label="Vue d'ensemble de votre portefeuille"
      className="relative overflow-hidden rounded-2xl border border-hairline bg-card"
    >
      {/* Subtle teal wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-accent/[0.04]"
      />
      {/* Vertical accent line */}
      <div aria-hidden className="absolute left-0 top-0 h-full w-1 bg-primary" />

      <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between lg:gap-8 lg:p-8">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Capital engagé restant
          </p>
          <p className="mt-2 flex items-baseline gap-2 font-display text-[28px] font-bold leading-none tracking-tight text-foreground sm:text-[36px] lg:text-[44px]">
            <span className="num">{formatGNF(stats.capitalCommitted)}</span>
            <span className="text-sm font-semibold text-muted-foreground sm:text-base lg:text-lg">GNF</span>
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground sm:text-sm">
            Réparti sur{" "}
            <span className="font-medium text-foreground num">{stats.active + stats.yourTurn}</span>{" "}
            {stats.active + stats.yourTurn > 1 ? "tontines actives" : "tontine active"}
            {stats.pending > 0 && (
              <>
                {" "}· <span className="num">{stats.pending}</span> en cours d'inscription
              </>
            )}
            .
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          {hasUpcoming ? (
            <>
              <p className="text-[12px] text-muted-foreground lg:text-right">
                Vous recevez bientôt{" "}
                <span className="font-semibold text-foreground num">
                  {formatGNF(stats.upcomingTurn!.amount, { withCurrency: true, compact: true })}
                </span>{" "}
                dans{" "}
                <span className="font-semibold text-foreground num">{stats.upcomingTurn!.days} j</span>{" "}
                sur <span className="font-medium text-foreground">{stats.upcomingTurn!.groupName}</span>.
              </p>
              <Link
                to="/cotisations"
                className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-700 sm:w-auto"
              >
                Préparer ma cagnotte
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <p className="inline-flex items-center gap-2 rounded-full border border-hairline bg-card px-3 py-1.5 text-[12px] text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Aucun tour imminent — tout est sous contrôle.
            </p>
          )}
        </div>
      </div>

      {/* Metrics banner */}
      <div className="relative grid grid-cols-1 divide-y divide-hairline border-t border-hairline bg-card/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <MetricCell
          label="Portefeuille"
          value={`${stats.total} ${stats.total > 1 ? "groupes" : "groupe"}`}
          hint={`${stats.active} actifs · ${stats.yourTurn} votre tour · ${stats.completed} clos`}
        />
        <MetricCell
          label="Cagnottes en circulation"
          value={
            <>
              <span className="num">{formatGNF(stats.cagnotteCumulee, { compact: true })}</span>
              <span className="ml-1 text-xs font-semibold text-muted-foreground">GNF</span>
            </>
          }
          hint="Sur cycles ouverts"
        />
        <MetricCell
          label="Score moyen"
          value={
            <span className="num">{stats.avgScore}%</span>
          }
          hint="Fiabilité pondérée"
          progress={stats.avgScore}
        />
      </div>
    </section>
  );
}

function MetricCell({
  label,
  value,
  hint,
  progress,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  progress?: number;
}) {
  return (
    <div className="min-w-0 px-5 py-4 sm:px-6">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-display text-lg font-bold text-foreground">{value}</p>
      {typeof progress === "number" && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
      {hint && <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}