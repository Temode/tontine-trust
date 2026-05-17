import { AlertOctagon, BellRing, Inbox, Megaphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { getNotificationsStats } from "@/lib/mock-data";

type Stats = ReturnType<typeof getNotificationsStats>;

interface KpiTileProps {
  icon: LucideIcon;
  label: string;
  primary: string;
  secondary?: string;
  tone?: "primary" | "warning" | "destructive" | "neutral";
}

function KpiTile({ icon: Icon, label, primary, secondary, tone = "neutral" }: KpiTileProps) {
  const toneClass = {
    primary: "bg-primary-50 text-primary",
    warning: "bg-warning/10 text-warning",
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

export function NotificationsKpiStrip({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        icon={Inbox}
        label="Non lues"
        primary={`${stats.unread} alertes`}
        secondary="Marquage automatique à 30 jours"
        tone={stats.unread > 0 ? "primary" : "neutral"}
      />
      <KpiTile
        icon={BellRing}
        label="Actions requises"
        primary={`${stats.requiresAction} en attente`}
        secondary="Réponse, paiement ou validation requis"
        tone={stats.requiresAction > 0 ? "warning" : "neutral"}
      />
      <KpiTile
        icon={AlertOctagon}
        label="Alertes critiques"
        primary={`${stats.critical} dossiers`}
        secondary={stats.critical > 0 ? "À traiter en priorité" : "Aucun incident actif"}
        tone={stats.critical > 0 ? "destructive" : "neutral"}
      />
      <KpiTile
        icon={Megaphone}
        label="Émetteurs distincts"
        primary={`${stats.distinctSources} canaux`}
        secondary="Groupes, services conformité et système"
      />
    </div>
  );
}
