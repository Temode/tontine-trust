import { Activity, Coins, Sparkles, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatGNF } from "@/lib/format";
import type { getPortfolioStats } from "@/lib/mock-data";

type Portfolio = ReturnType<typeof getPortfolioStats>;

interface KpiTileProps {
  icon: LucideIcon;
  label: string;
  primary: string;
  secondary?: string;
  tone?: "primary" | "accent" | "neutral";
}

function KpiTile({ icon: Icon, label, primary, secondary, tone = "neutral" }: KpiTileProps) {
  const toneClass =
    tone === "primary"
      ? "bg-primary-50 text-primary"
      : tone === "accent"
      ? "bg-accent-50 text-accent-700"
      : "bg-secondary text-foreground";

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

export function GroupsKpiStrip({ stats }: { stats: Portfolio }) {
  const upcomingLabel = stats.upcomingTurn
    ? `${formatGNF(stats.upcomingTurn.amount, { withCurrency: true, compact: true })} dans ${stats.upcomingTurn.days} j`
    : "Aucun tour imminent";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        icon={Activity}
        label="Portefeuille"
        primary={`${stats.total} groupes`}
        secondary={`${stats.active} actifs · ${stats.yourTurn} votre tour · ${stats.pending} en cours · ${stats.completed} clos`}
        tone="primary"
      />
      <KpiTile
        icon={Wallet}
        label="Capital engagé restant"
        primary={`${formatGNF(stats.capitalCommitted)} GNF`}
        secondary="Cotisations futures sur cycles ouverts"
      />
      <KpiTile
        icon={Coins}
        label="Cagnottes en circulation"
        primary={`${formatGNF(stats.cagnotteCumulee)} GNF`}
        secondary={`Prochaine cagnotte : ${upcomingLabel}`}
        tone="accent"
      />
      <KpiTile
        icon={Sparkles}
        label="Score moyen du portefeuille"
        primary={`${stats.avgScore}%`}
        secondary="Pondéré par les membres actifs"
      />
    </div>
  );
}
