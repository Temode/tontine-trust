import { CalendarCheck2, Coins, Repeat2, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatGNF } from "@/lib/format";
import type { getRotationStats } from "@/lib/mock-data";

type Stats = ReturnType<typeof getRotationStats>;

interface KpiTileProps {
  icon: LucideIcon;
  label: string;
  primary: string;
  secondary?: string;
  tone?: "primary" | "accent" | "success" | "neutral";
}

function KpiTile({ icon: Icon, label, primary, secondary, tone = "neutral" }: KpiTileProps) {
  const toneClass = {
    primary: "bg-primary-50 text-primary",
    accent: "bg-accent-50 text-accent-700",
    success: "bg-success/10 text-success",
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

export function RotationsKpiStrip({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        icon={Trophy}
        label="Vos prochains tours"
        primary={`${stats.yourUpcomingCount} versements`}
        secondary={`Encaissement attendu : ${formatGNF(stats.expectedAmount, { withCurrency: true, compact: true })}`}
        tone="accent"
      />
      <KpiTile
        icon={Coins}
        label="Tours déjà reçus"
        primary={`${formatGNF(stats.receivedAmount, { withCurrency: true, compact: true })}`}
        secondary={`${stats.yourReceivedCount} cagnottes encaissées`}
        tone="success"
      />
      <KpiTile
        icon={CalendarCheck2}
        label="Volume des 90 prochains jours"
        primary={`${stats.next90} tours`}
        secondary="Sur l'ensemble de votre portefeuille"
        tone="primary"
      />
      <KpiTile
        icon={Repeat2}
        label="Taux de complétion"
        primary={`${stats.completionRate}%`}
        secondary={`${stats.completedCycle} / ${stats.totalCycle} tours bouclés`}
      />
    </div>
  );
}
