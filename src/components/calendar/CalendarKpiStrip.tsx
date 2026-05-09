import { AlertTriangle, CalendarRange, Coins, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatGNF } from "@/lib/format";
import type { getCalendarStats } from "@/lib/mock-data";

type Stats = ReturnType<typeof getCalendarStats>;

interface KpiTileProps {
  icon: LucideIcon;
  label: string;
  primary: string;
  secondary?: string;
  tone?: "primary" | "accent" | "warning" | "neutral";
}

function KpiTile({ icon: Icon, label, primary, secondary, tone = "neutral" }: KpiTileProps) {
  const toneClass = {
    primary: "bg-primary-50 text-primary",
    accent: "bg-accent-50 text-accent-700",
    warning: "bg-warning/10 text-warning",
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

export function CalendarKpiStrip({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        icon={Layers}
        label="Événements ce mois"
        primary={`${stats.monthCount} entrées`}
        secondary="Tout type confondu"
        tone="primary"
      />
      <KpiTile
        icon={CalendarRange}
        label="À venir cette semaine"
        primary={`${stats.weekCount} échéances`}
        secondary="Sur les 7 prochains jours"
      />
      <KpiTile
        icon={AlertTriangle}
        label="Action sous 3 jours"
        primary={`${stats.urgentCount} points chauds`}
        secondary={stats.urgentCount > 0 ? "Vigilance requise" : "Aucune urgence"}
        tone={stats.urgentCount > 0 ? "warning" : "neutral"}
      />
      <KpiTile
        icon={Coins}
        label="Capital mobilisé ce mois"
        primary={`${formatGNF(stats.monthCapital, { withCurrency: true, compact: true })}`}
        secondary="Cumul cotisations + tours"
        tone="accent"
      />
    </div>
  );
}
