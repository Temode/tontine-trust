import { ArrowDownLeft, ArrowUpRight, ShieldCheck, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatGNF } from "@/lib/format";
import type { UserProfile } from "@/lib/types";

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

export function TrackRecordStrip({ profile }: { profile: UserProfile }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        icon={ArrowUpRight}
        label="Capital cumulé engagé"
        primary={`${formatGNF(profile.lifetimeContributions, { withCurrency: true, compact: true })}`}
        secondary="Cotisations payées sur tous les cycles"
        tone="primary"
      />
      <KpiTile
        icon={ArrowDownLeft}
        label="Cagnottes encaissées"
        primary={`${formatGNF(profile.lifetimeCagnottes, { withCurrency: true, compact: true })}`}
        secondary={`${profile.cyclesCompleted} cycles bouclés sans manquement`}
        tone="success"
      />
      <KpiTile
        icon={Trophy}
        label="Cycles actifs"
        primary={`${profile.cyclesActive} portefeuille`}
        secondary={`${profile.cyclesCompleted} clôturés depuis l'inscription`}
        tone="accent"
      />
      <KpiTile
        icon={ShieldCheck}
        label="Score · Taux à temps"
        primary={`${profile.reliabilityScore}% / ${profile.onTimeRate}%`}
        secondary="Score interne · ponctualité 12 mois"
      />
    </div>
  );
}
