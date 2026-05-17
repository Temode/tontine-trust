import { cn } from "@/lib/utils";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import type { CalendarEvent } from "@/lib/types";
import { EVENT_VISUALS } from "./eventVisuals";

interface UpcomingEventsCardProps {
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  limit?: number;
}

const MONTHS_FR = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEP", "OCT", "NOV", "DÉC"];

export function UpcomingEventsCard({ events, onEventClick, limit = 6 }: UpcomingEventsCardProps) {
  const upcoming = events
    .filter((e) => e.daysFromToday >= 0)
    .slice()
    .sort((a, b) => a.daysFromToday - b.daysFromToday)
    .slice(0, limit);

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Prochains événements</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">{limit} entrées les plus imminentes</p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-success/10 px-2 py-1 text-[11px] font-medium text-success sm:inline-flex">
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-success" />
          Live
        </span>
      </header>

      <ul className="divide-y divide-border/50">
        {upcoming.length === 0 && (
          <li className="px-6 py-12 text-center text-sm text-muted-foreground">
            Aucun événement à venir sur l'horizon visible.
          </li>
        )}
        {upcoming.map((e) => {
          const v = EVENT_VISUALS[e.type];
          const Icon = v.Icon;
          const [, m, d] = e.date.split("-").map(Number);
          const isUrgent = e.daysFromToday <= 3;
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onEventClick(e)}
                className="group flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-secondary/30 lg:px-6"
              >
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md border border-hairline bg-card">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {MONTHS_FR[m - 1]}
                  </span>
                  <span className="font-display text-base font-bold leading-none num">{d}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded", v.bg, v.fg)}>
                      <Icon className="h-3 w-3" strokeWidth={2.25} />
                    </span>
                    <p className="truncate text-sm font-semibold text-foreground">{e.title}</p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {e.time && <span className="num">{e.time} · </span>}
                    <span className={cn(isUrgent && "text-warning")}>{formatRelativeDays(e.daysFromToday)}</span>
                    {e.groupName && <span> · {e.groupName}</span>}
                  </p>
                </div>

                {e.amount !== undefined && (
                  <p className="hidden shrink-0 font-display text-sm font-bold text-foreground num sm:block">
                    {formatGNF(e.amount, { withCurrency: true, compact: e.amount >= 1_000_000 })}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
