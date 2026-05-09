import { useMemo } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import type { CalendarEvent } from "@/lib/types";
import { TODAY_REFERENCE } from "@/lib/mock-data";
import { EVENT_VISUALS } from "./eventVisuals";

interface AgendaViewProps {
  cursor: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
}

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const WEEKDAYS_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

interface DayBucket {
  iso: string;
  date: Date;
  isToday: boolean;
  events: CalendarEvent[];
}

export function AgendaView({ cursor, events, onEventClick }: AgendaViewProps) {
  const buckets = useMemo<DayBucket[]>(() => {
    const todayIso = isoOf(TODAY_REFERENCE);
    const monthYear = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const inMonth = events.filter((e) => e.date.startsWith(monthYear));
    const map = new Map<string, CalendarEvent[]>();
    for (const e of inMonth) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return Array.from(map.entries())
      .map(([iso, list]) => {
        const [y, m, d] = iso.split("-").map(Number);
        const date = new Date(y, m - 1, d);
        return {
          iso,
          date,
          isToday: iso === todayIso,
          events: [...list].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")),
        };
      })
      .sort((a, b) => a.iso.localeCompare(b.iso));
  }, [cursor, events]);

  if (buckets.length === 0) {
    return (
      <article className="rounded-xl border border-hairline bg-card px-6 py-14 text-center text-sm text-muted-foreground">
        Aucun événement programmé pour ce mois.
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between border-b border-hairline px-5 py-4 lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Agenda du mois</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            {events.filter((e) => e.date.startsWith(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`)).length} événements programmés
          </p>
        </div>
      </header>

      <ul className="divide-y divide-border/50">
        {buckets.map((bucket) => (
          <li key={bucket.iso} className="px-5 py-4 lg:px-6">
            <DayHeader date={bucket.date} isToday={bucket.isToday} count={bucket.events.length} />
            <ul className="mt-3 space-y-2">
              {bucket.events.map((e) => (
                <AgendaRow key={e.id} event={e} onClick={() => onEventClick(e)} />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </article>
  );
}

function DayHeader({ date, isToday, count }: { date: Date; isToday: boolean; count: number }) {
  const weekday = WEEKDAYS_FR[date.getDay()];
  const month = MONTHS_FR[date.getMonth()];
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            "inline-flex h-9 min-w-[36px] items-center justify-center rounded-md text-base font-bold num",
            isToday ? "bg-primary px-2 text-primary-foreground" : "border border-hairline text-foreground",
          )}
        >
          {date.getDate()}
        </span>
        <div>
          <p className={cn("text-sm font-semibold", isToday ? "text-primary" : "text-foreground")}>
            {weekday} {date.getDate()} {month}
          </p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {count} {count > 1 ? "événements" : "événement"}
          </p>
        </div>
      </div>
    </div>
  );
}

function AgendaRow({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const v = EVENT_VISUALS[event.type];
  const Icon = v.Icon;
  const isYourTurn = event.type === "your-turn";

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition",
          isYourTurn
            ? "border-accent-300 bg-accent-50/50 hover:bg-accent-50"
            : "border-hairline hover:bg-secondary/40",
        )}
      >
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", v.bg, v.fg)}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{event.title}</p>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider",
                v.bg,
                v.fg,
              )}
            >
              {v.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {event.time && (
              <>
                <Clock className="-mt-0.5 mr-1 inline h-3 w-3" />
                <span className="num">{event.time}</span>
                {event.endTime && (
                  <>
                    <span className="mx-0.5">–</span>
                    <span className="num">{event.endTime}</span>
                  </>
                )}
                <span className="mx-1.5">·</span>
              </>
            )}
            <span>{formatRelativeDays(event.daysFromToday)}</span>
            {event.groupName && (
              <>
                <span className="mx-1.5">·</span>
                <span>{event.groupName}</span>
              </>
            )}
          </p>
        </div>

        {event.amount !== undefined && (
          <p className="hidden shrink-0 text-right font-display text-sm font-bold num sm:block">
            {formatGNF(event.amount, { withCurrency: true, compact: event.amount >= 1_000_000 })}
          </p>
        )}
      </button>
    </li>
  );
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
