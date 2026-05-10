import { Inbox, Send, Timer, UserPlus2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { getInviteStats } from "@/lib/mock-data";

type Stats = ReturnType<typeof getInviteStats>;

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

export function InviteKpiStrip({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        icon={UserPlus2}
        label="Places à pourvoir"
        primary={`${stats.slots} sièges`}
        secondary={`${stats.joined} membres déjà confirmés`}
        tone={stats.slots > 0 ? "warning" : "primary"}
      />
      <KpiTile
        icon={Send}
        label="Invitations émises"
        primary={`${stats.sent} envoyées`}
        secondary={`${stats.opened} ouvertes · ${stats.joined} acceptées`}
      />
      <KpiTile
        icon={Inbox}
        label="Demandes à valider"
        primary={`${stats.pendingRequests} en attente`}
        secondary="Candidatures spontanées via lien ou annuaire"
        tone={stats.pendingRequests > 0 ? "warning" : "neutral"}
      />
      <KpiTile
        icon={Timer}
        label="Taux de conversion"
        primary={`${stats.conversion}%`}
        secondary={
          stats.avgResponseHours > 0
            ? `Réponse en ${stats.avgResponseHours}h en moyenne`
            : "Délai moyen non disponible"
        }
        tone="accent"
      />
    </div>
  );
}
