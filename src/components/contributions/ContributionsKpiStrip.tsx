import { AlertTriangle, CheckCircle2, Clock, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatGNF } from "@/lib/format";
import type { getContributionsStats } from "@/lib/mock-data";

type Stats = ReturnType<typeof getContributionsStats>;

interface KpiTileProps {
  icon: LucideIcon;
  label: string;
  primary: string;
  secondary?: string;
  tone?: "primary" | "success" | "warning" | "destructive";
}

function KpiTile({ icon: Icon, label, primary, secondary, tone = "primary" }: KpiTileProps) {
  const toneClass = {
    primary: "bg-primary-50 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <article className="flex items-start gap-4 rounded-xl border border-hairline bg-card p-5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 truncate font-display text-2xl font-bold text-foreground num">{primary}</p>
        {secondary && <p className="mt-0.5 truncate text-xs text-muted-foreground">{secondary}</p>}
      </div>
    </article>
  );
}

export function ContributionsKpiStrip({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        icon={Clock}
        label="Cotisations à venir"
        primary={`${stats.upcomingCount} échéances`}
        secondary={`Engagement total : ${formatGNF(stats.upcomingTotal, { withCurrency: true })}`}
      />
      <KpiTile
        icon={Wallet}
        label="Payées (30 derniers jours)"
        primary={`${formatGNF(stats.paid30Total)} GNF`}
        secondary={`${stats.paid30Count} opérations confirmées`}
        tone="success"
      />
      <KpiTile
        icon={AlertTriangle}
        label="À régler cette semaine"
        primary={`${stats.dueSoonCount} échéances`}
        secondary={
          stats.dueSoonTotal > 0
            ? `${formatGNF(stats.dueSoonTotal, { withCurrency: true })} dans 7 jours`
            : "Aucune échéance imminente"
        }
        tone={stats.dueSoonCount > 0 ? "warning" : "primary"}
      />
      <KpiTile
        icon={CheckCircle2}
        label="Taux de paiement à temps"
        primary={`${stats.onTimeRate}%`}
        secondary={`${stats.onTimeCount} à temps · ${stats.lateCount} en retard`}
        tone="success"
      />
    </div>
  );
}
