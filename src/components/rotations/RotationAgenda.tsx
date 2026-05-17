import { useMemo, useState } from "react";
import { ArrowRight, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import type { Turn } from "@/lib/types";

type Filter = "all" | "yours";

interface RotationAgendaProps {
  turns: Turn[];
}

export function RotationAgenda({ turns }: RotationAgendaProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const upcoming = turns.filter((t) => t.status !== "completed" && t.daysFromToday >= 0);
    return filter === "yours" ? upcoming.filter((t) => t.isYou) : upcoming;
  }, [turns, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Turn[]>();
    for (const t of visible) {
      const month = t.date.split(" ").slice(1).join(" "); // "Jan 2025"
      if (!map.has(month)) map.set(month, []);
      map.get(month)!.push(t);
    }
    for (const list of map.values()) list.sort((a, b) => a.daysFromToday - b.daysFromToday);
    return Array.from(map.entries());
  }, [visible]);

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Agenda des tours</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            {visible.length} {visible.length > 1 ? "événements" : "événement"} sur l'horizon visible
          </p>
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-md bg-secondary/60 p-0.5">
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")} label="Tous" />
          <FilterButton active={filter === "yours"} onClick={() => setFilter("yours")} label="Mes tours" />
        </div>
      </header>

      <div className="divide-y divide-border/50">
        {grouped.map(([month, items]) => (
          <section key={month} className="px-5 py-4 lg:px-6">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {month}
            </h3>
            <ul className="space-y-1.5">
              {items.map((t) => (
                <AgendaRow key={t.id} turn={t} />
              ))}
            </ul>
          </section>
        ))}

        {grouped.length === 0 && (
          <div className="px-6 py-14 text-center text-sm text-muted-foreground">
            Aucun tour à afficher pour ce filtre.
          </div>
        )}
      </div>
    </article>
  );
}

function AgendaRow({ turn }: { turn: Turn }) {
  const day = turn.date.split(" ")[0]?.padStart(2, "0") ?? "—";
  const isYou = turn.isYou;
  const isCurrent = turn.status === "current";

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-3 transition-colors",
        isYou
          ? "border-accent-300 bg-accent-50/60 hover:bg-accent-50"
          : isCurrent
          ? "border-primary-100 bg-primary-50/60 hover:bg-primary-50"
          : "border-hairline hover:bg-secondary/40",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border",
          isYou
            ? "border-accent-300 bg-card text-accent-700"
            : isCurrent
            ? "border-primary-100 bg-card text-primary"
            : "border-hairline bg-card text-foreground",
        )}
      >
        <span className="font-display text-base font-bold leading-none num">{day}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{turn.groupName}</p>
          <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            #{turn.index}
          </span>
          {isYou && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-700">
              <Trophy className="h-3 w-3" />
              Vous
            </span>
          )}
          {isCurrent && !isYou && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              Tour actif
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {turn.beneficiaryName} · {formatRelativeDays(turn.daysFromToday)}
        </p>
      </div>

      <div className="hidden text-right sm:block">
        <p className="font-display text-sm font-bold text-foreground num">
          {formatGNF(turn.amount, { withCurrency: true, compact: turn.amount >= 1_000_000 })}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {turn.contributorsPaid}/{turn.contributorsTotal} contributeurs
        </p>
      </div>

      <Link
        to={`/groupes/${turn.groupId}`}
        aria-label={`Voir le groupe ${turn.groupName}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
      </Link>
    </li>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded px-2.5 py-1 text-xs font-medium transition",
        active ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
