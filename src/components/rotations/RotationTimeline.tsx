import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { Turn } from "@/lib/types";

interface RotationTimelineProps {
  turns: Turn[];
  /** Span (days from today) shown on the timeline. Defaults to 120 (~4 months). */
  horizonDays?: number;
}

/**
 * Bloomberg-style swim-lane "yield calendar":
 * each row is a group, the X axis is time, markers indicate each upcoming turn.
 * Markers in champagne represent the user's tours; today is materialised by a
 * vertical line; horizontal scrolling is enabled on small viewports.
 */
const HORIZON_START_DAYS = -14;

export function RotationTimeline({ turns, horizonDays = 120 }: RotationTimelineProps) {
  const span = horizonDays - HORIZON_START_DAYS;

  const lanes = useMemo(() => {
    const map = new Map<string, { groupId: string; groupName: string; turns: Turn[] }>();
    for (const t of turns) {
      if (t.daysFromToday < HORIZON_START_DAYS || t.daysFromToday > horizonDays) continue;
      const lane = map.get(t.groupId) ?? { groupId: t.groupId, groupName: t.groupName, turns: [] };
      lane.turns.push(t);
      map.set(t.groupId, lane);
    }
    return Array.from(map.values()).map((l) => ({
      ...l,
      turns: [...l.turns].sort((a, b) => a.daysFromToday - b.daysFromToday),
    }));
  }, [turns, horizonDays]);

  // Month gridlines: take "today" as origin, place ticks at every 30 days.
  const ticks = useMemo(() => {
    const result: Array<{ days: number; label: string }> = [];
    const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    const today = new Date(2025, 0, 3);
    for (let d = -14; d <= horizonDays; d += 14) {
      const date = new Date(today.getTime() + d * 86_400_000);
      const label = `${date.getDate()} ${months[date.getMonth()]}`;
      result.push({ days: d, label });
    }
    return result;
  }, [horizonDays]);

  const xPercent = (days: number) => ((days - HORIZON_START_DAYS) / span) * 100;

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">
            Calendrier des tours
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Vue {horizonDays} jours · markers en or = vos tours · ligne verticale = aujourd'hui
          </p>
        </div>

        <Legend />
      </header>

      <div className="overflow-x-auto px-5 pb-5 pt-4 scrollbar-thin lg:px-6">
        <div className="min-w-[760px]">
          {/* Axis */}
          <div className="relative mb-4 ml-44 h-7 border-b border-hairline">
            {ticks.map((t) => (
              <div
                key={t.days}
                className="absolute top-0 -translate-x-1/2 text-[10px] uppercase tracking-wider text-muted-foreground"
                style={{ left: `${xPercent(t.days)}%` }}
              >
                {t.label}
              </div>
            ))}
            {/* Today marker */}
            <div
              aria-hidden
              className="absolute bottom-0 top-0 w-px -translate-x-1/2 bg-primary/60"
              style={{ left: `${xPercent(0)}%` }}
            />
            <span
              aria-hidden
              className="absolute -translate-x-1/2 whitespace-nowrap rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary-foreground"
              style={{ left: `${xPercent(0)}%`, bottom: -2 }}
            >
              Aujourd'hui
            </span>
          </div>

          {/* Swim lanes */}
          <ul className="divide-y divide-border/50">
            {lanes.map((lane) => (
              <li key={lane.groupId} className="grid grid-cols-[176px_1fr] items-center gap-4 py-3.5">
                <Link
                  to={`/groupes/${lane.groupId}`}
                  className="group inline-flex items-center justify-between gap-2 rounded-md text-left"
                >
                  <span className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                    {lane.groupName}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:text-primary" />
                </Link>

                <div className="relative h-9 rounded-md bg-secondary/40">
                  {/* Today line */}
                  <div
                    aria-hidden
                    className="absolute inset-y-0 w-px bg-primary/40"
                    style={{ left: `${xPercent(0)}%` }}
                  />
                  {lane.turns.map((t) => (
                    <TurnMarker key={t.id} turn={t} left={xPercent(t.daysFromToday)} />
                  ))}
                </div>
              </li>
            ))}

            {lanes.length === 0 && (
              <li className="py-10 text-center text-sm text-muted-foreground">
                Aucun tour prévu sur l'horizon affiché.
              </li>
            )}
          </ul>
        </div>
      </div>
    </article>
  );
}

function TurnMarker({ turn, left }: { turn: Turn; left: number }) {
  const isCurrent = turn.status === "current";
  const isPast = turn.status === "completed";
  const isYou = turn.isYou;

  return (
    <div
      className={cn(
        "group absolute top-1/2 -translate-x-1/2 -translate-y-1/2",
      )}
      style={{ left: `${left}%` }}
    >
      <div
        aria-hidden
        className={cn(
          "h-3 w-3 rounded-full border-2 transition-transform group-hover:scale-125",
          isYou
            ? "border-accent-700 bg-accent-500 shadow-sm"
            : isCurrent
            ? "border-primary bg-primary-foreground"
            : isPast
            ? "border-muted-foreground/30 bg-muted-foreground/30"
            : "border-primary/70 bg-card",
        )}
      />
      <div
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-md border border-hairline bg-popover px-3 py-2 text-left opacity-0 shadow-card transition group-hover:pointer-events-auto group-hover:opacity-100"
      >
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Tour {turn.index}/{turn.total} · {turn.date}
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-foreground">
          {isYou ? "Vous recevez la cagnotte" : `Bénéficiaire : ${turn.beneficiaryName}`}
        </p>
        <p className="mt-1 font-display text-sm font-bold text-foreground num">
          {formatGNF(turn.amount, { withCurrency: true })}
        </p>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="hidden items-center gap-3 text-[11px] sm:flex">
      <LegendDot className="border-2 border-accent-700 bg-accent-500" label="Votre tour" />
      <LegendDot className="border-2 border-primary bg-primary-foreground" label="Tour actif" />
      <LegendDot className="border-2 border-primary/70 bg-card" label="À venir" />
      <LegendDot className="border-2 border-muted-foreground/30 bg-muted-foreground/30" label="Terminé" />
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", className)} />
      {label}
    </span>
  );
}
