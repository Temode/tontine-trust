import { Coins, Compass, Hourglass, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatGNF } from "@/lib/format";
import type { getJoinStats } from "@/lib/mock-data";

type Stats = ReturnType<typeof getJoinStats>;

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

export function JoinKpiStrip({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        icon={Compass}
        label="Groupes ouverts"
        primary={`${stats.openCount} émissions`}
        secondary="Disponibles dans l'annuaire public"
        tone="primary"
      />
      <KpiTile
        icon={Hourglass}
        label="Démarrages imminents"
        primary={`${stats.startingSoon} cycles`}
        secondary="Premier prélèvement sous 14 jours"
        tone={stats.startingSoon > 0 ? "warning" : "neutral"}
      />
      <KpiTile
        icon={Coins}
        label="Cotisation médiane"
        primary={`${formatGNF(stats.medianContribution, { withCurrency: true, compact: true })}`}
        secondary="Sur les groupes actuellement ouverts"
        tone="accent"
      />
      <KpiTile
        icon={Inbox}
        label="Vos candidatures"
        primary={`${stats.pendingApplications} en attente`}
        secondary="En attente de validation par l'organisateur"
      />
    </div>
  );
}
