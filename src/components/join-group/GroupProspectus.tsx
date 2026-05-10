import { ArrowRight, Coins, ShieldCheck, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import type { DirectoryGroup } from "@/lib/types";

const ROTATION_LABEL: Record<DirectoryGroup["rotationOrder"], string> = {
  random: "Tirage au sort",
  fixed: "Ordre fixe",
  auction: "Enchères",
  choice: "Choix individuel",
};

const SWAP_LABEL: Record<DirectoryGroup["swapPolicy"], string> = {
  open: "Échanges libres",
  consensus: "Échanges sur consensus",
  closed: "Échanges interdits",
};

const CATEGORY_LABEL: Record<DirectoryGroup["category"], string> = {
  family: "Famille",
  professional: "Collègues",
  business: "Commerçants",
  community: "Communauté",
};

interface GroupProspectusProps {
  group: DirectoryGroup;
  onSubscribe: (group: DirectoryGroup) => void;
  onDismiss?: () => void;
}

export function GroupProspectus({ group, onSubscribe, onDismiss }: GroupProspectusProps) {
  const cagnotte = group.contribution * group.members;
  const cycleDays =
    group.frequency === "Hebdomadaire" ? 7 * group.members : group.frequency === "Quinzaine" ? 14 * group.members : 30 * group.members;
  const cycleLabel =
    cycleDays >= 365
      ? `${(cycleDays / 365).toFixed(1)} an${cycleDays >= 730 ? "s" : ""}`
      : `${Math.round(cycleDays / 30)} mois`;
  const slots = group.members - group.filled;
  const fillRate = Math.round((group.filled / group.members) * 100);

  return (
    <article className="overflow-hidden rounded-xl border border-hairline bg-card">
      {/* Header */}
      <header className="border-b border-hairline bg-secondary/40 px-5 py-5 lg:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Tontine Digital · Prospectus de souscription
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
            Émission active
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-bold leading-tight text-foreground lg:text-3xl">
              {group.name}
            </h2>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              {CATEGORY_LABEL[group.category]} · Cycle {cycleLabel} · Ouvert le {group.createdOn}
            </p>
            <p className="mt-3 max-w-prose text-sm text-muted-foreground">{group.description}</p>
          </div>

          <button
            type="button"
            onClick={() => onSubscribe(group)}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-700"
          >
            Souscrire
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Top metrics row */}
      <section className="grid grid-cols-2 gap-px border-b border-hairline bg-border lg:grid-cols-4">
        <Metric label="Cotisation par tour" value={`${formatGNF(group.contribution)} GNF`} icon={<Coins className="h-3.5 w-3.5" />} />
        <Metric
          label="Cagnotte par tour"
          value={`${formatGNF(cagnotte, { compact: cagnotte >= 1_000_000 })} GNF`}
          accent
        />
        <Metric label="Fréquence" value={group.frequency} />
        <Metric
          label="Démarrage"
          value={group.startsInDays >= 0 ? formatRelativeDays(group.startsInDays) : "Cycle en cours"}
        />
      </section>

      {/* Sections grid */}
      <div className="grid grid-cols-1 gap-px bg-border lg:grid-cols-3">
        {/* Termes financiers */}
        <ProspectusSection title="Termes financiers">
          <Field label="Cycle" value={cycleLabel} />
          <Field label="Membres au complet" value={<span className="num">{group.members}</span>} />
          <Field label="Pénalité de retard" value={group.latePenaltyPercent === 0 ? "Aucune" : `${group.latePenaltyPercent}%`} />
        </ProspectusSection>

        {/* Gouvernance */}
        <ProspectusSection title="Gouvernance">
          <Field label="Ordre de rotation" value={ROTATION_LABEL[group.rotationOrder]} />
          <Field label="Politique d'échange" value={SWAP_LABEL[group.swapPolicy]} />
          <Field
            label="Visibilité"
            value={group.visibility === "directory" ? "Annuaire public" : "Lien partageable"}
          />
        </ProspectusSection>

        {/* Organisateur */}
        <ProspectusSection title="Émetteur">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              {group.organizerInitials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{group.organizerName}</p>
              <p className="text-[11px] text-muted-foreground">Organisateur principal</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Score org." value={`${group.organizerScore}%`} accent="success" />
            <Stat label="Score moyen" value={`${group.meanScore}%`} />
          </div>
        </ProspectusSection>
      </div>

      {/* Capacity bar */}
      <section className="border-t border-hairline px-5 py-5 lg:px-7">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Capacité
            </p>
            <p className="mt-1 inline-flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-display font-semibold text-foreground num">
                {group.filled}/{group.members}
              </span>{" "}
              <span className="text-muted-foreground">membres confirmés</span>
            </p>
          </div>
          <p className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
            slots <= 2 ? "bg-warning/10 text-warning" : "bg-success/10 text-success",
          )}>
            {slots} {slots > 1 ? "places restantes" : "place restante"}
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary" style={{ width: `${fillRate}%` }} />
        </div>
      </section>

      {/* Rules */}
      <section className="border-t border-hairline px-5 py-5 lg:px-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Règles du contrat
        </p>
        <ul className="mt-3 space-y-2">
          {group.rules.map((rule, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="text-sm text-foreground">{rule}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-secondary/30 px-5 py-4 lg:px-7">
        <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Document horodaté · contraignant à la souscription · révocable avant le démarrage du cycle
        </p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            Saisir un autre code
          </button>
        )}
      </footer>
    </article>
  );
}

function ProspectusSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card px-5 py-4 lg:px-6">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </p>
      <dl className="mt-3 space-y-2.5">{children}</dl>
    </section>
  );
}

function Metric({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="bg-card px-4 py-3.5">
      <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={cn("mt-1 font-display text-base font-bold num", accent ? "text-accent-700" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "success" }) {
  return (
    <div className="rounded-md border border-hairline bg-secondary/30 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-display text-sm font-bold num", accent === "success" ? "text-success" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}
