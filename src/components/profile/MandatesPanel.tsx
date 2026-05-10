import { ArrowRight, Briefcase, Crown, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { TontineGroup } from "@/lib/types";

interface MandatesPanelProps {
  groups: TontineGroup[];
}

export function MandatesPanel({ groups }: MandatesPanelProps) {
  const organized = groups.filter((g) => g.role === "organizer");
  const participated = groups.filter((g) => g.role === "participant");

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Mandats actifs</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Vos rôles sur l'ensemble des cycles ouverts
          </p>
        </div>
        <Link
          to="/groupes"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:text-primary-700"
        >
          Voir tous
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-px border-b border-hairline bg-border lg:grid-cols-2">
        <Section icon={<Crown className="h-4 w-4" />} label="Organisateur" count={organized.length}>
          {organized.length === 0 ? (
            <Empty>Vous n'organisez aucun groupe pour l'instant.</Empty>
          ) : (
            <ul className="space-y-2">
              {organized.map((g) => (
                <MandateRow key={g.id} group={g} role="organizer" />
              ))}
            </ul>
          )}
        </Section>

        <Section icon={<Users className="h-4 w-4" />} label="Participant" count={participated.length}>
          {participated.length === 0 ? (
            <Empty>Vous ne participez à aucun groupe pour l'instant.</Empty>
          ) : (
            <ul className="space-y-2">
              {participated.map((g) => (
                <MandateRow key={g.id} group={g} role="participant" />
              ))}
            </ul>
          )}
        </Section>
      </div>
    </article>
  );
}

function Section({
  icon,
  label,
  count,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card px-5 py-5 lg:px-6">
      <header className="mb-3 flex items-center justify-between">
        <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-50 text-primary">
            {icon}
          </span>
          {label}
        </p>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground num">
          {count}
        </span>
      </header>
      {children}
    </section>
  );
}

function MandateRow({ group, role }: { group: TontineGroup; role: "organizer" | "participant" }) {
  const turnsCompleted = Math.round((group.progress / 100) * group.members);

  return (
    <li>
      <Link
        to={`/groupes/${group.id}`}
        className="group flex items-center gap-3 rounded-md border border-hairline px-3 py-2.5 transition hover:bg-secondary/40"
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-primary-foreground",
            role === "organizer" ? "bg-primary" : "bg-accent-700",
          )}
        >
          <Briefcase className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{group.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {group.frequency} ·{" "}
            <span className="num">
              {formatGNF(group.contribution, { compact: group.contribution >= 1_000_000 })} GNF
            </span>{" "}
            · tour <span className="num">{turnsCompleted}/{group.members}</span>
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
      </Link>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-hairline px-3 py-4 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}
