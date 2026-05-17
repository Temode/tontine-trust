import { ArrowDownLeft, ArrowUpRight, ShieldCheck, Sigma } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatGNF } from "@/lib/format";
import type { getHistoryStats } from "@/lib/mock-data";

type Stats = ReturnType<typeof getHistoryStats>;

interface KpiTileProps {
  icon: LucideIcon;
  label: string;
  primary: string;
  secondary?: string;
  tone?: "primary" | "success" | "destructive" | "neutral";
}

function KpiTile({ icon: Icon, label, primary, secondary, tone = "neutral" }: KpiTileProps) {
  const toneClass = {
    primary: "bg-primary-50 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    neutral: "bg-secondary text-foreground",
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

export function HistoryKpiStrip({ stats }: { stats: Stats }) {
  const netSign = stats.net >= 0 ? "+" : "−";
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        icon={Sigma}
        label="Volume net (12 mois)"
        primary={`${netSign}${formatGNF(Math.abs(stats.net), { withCurrency: true })}`}
        secondary={`Sur ${stats.operations} opérations enregistrées`}
        tone={stats.net >= 0 ? "success" : "destructive"}
      />
      <KpiTile
        icon={ArrowDownLeft}
        label="Entrées cumulées"
        primary={`${formatGNF(stats.inflow, { withCurrency: true })}`}
        secondary="Cagnottes versées et bonus"
        tone="success"
      />
      <KpiTile
        icon={ArrowUpRight}
        label="Sorties cumulées"
        primary={`${formatGNF(stats.outflow, { withCurrency: true })}`}
        secondary="Cotisations payées"
      />
      <KpiTile
        icon={ShieldCheck}
        label="Taux d'exécution"
        primary={`${stats.executionRate}%`}
        secondary={`${stats.failedCount} opérations échouées`}
        tone="primary"
      />
    </div>
  );
}
