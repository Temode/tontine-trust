import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { CalendarEvent } from "@/lib/types";
import { TODAY_REFERENCE } from "@/lib/mock-data";
import { EVENT_VISUALS } from "./eventVisuals";

interface MonthViewProps {
  cursor: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
}

const WEEKDAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

interface DayCell {
  iso: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: CalendarEvent[];
}

/**
 * Build a 6-row × 7-col grid of dates surrounding a cursor month.
 * Week starts on Monday — the European convention used in Guinea.
 */
function buildMonthGrid(cursor: Date, events: CalendarEvent[]): DayCell[] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const dayOfWeek = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(year, month, 1 - dayOfWeek);

  const todayIso = isoOf(TODAY_REFERENCE);
  const cells: DayCell[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = isoOf(d);
    const dow = d.getDay();
    cells.push({
      iso,
      dayNumber: d.getDate(),
      isCurrentMonth: d.getMonth() === month,
      isToday: iso === todayIso,
      isWeekend: dow === 0 || dow === 6,
      events: events.filter((e) => e.date === iso),
    });
  }

  return cells;
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MonthView({ cursor, events, onEventClick }: MonthViewProps) {
  const cells = useMemo(() => buildMonthGrid(cursor, events), [cursor, events]);

  return (
    <article className="overflow-hidden rounded-xl border border-hairline bg-card">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-hairline bg-secondary/40">
        {WEEKDAYS_FR.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 grid-rows-6 divide-x divide-y divide-border/60">
        {cells.map((cell) => (
          <DayCellView key={cell.iso} cell={cell} onEventClick={onEventClick} />
        ))}
      </div>
    </article>
  );
}

interface DayCellViewProps {
  cell: DayCell;
  onEventClick: (e: CalendarEvent) => void;
}

function DayCellView({ cell, onEventClick }: DayCellViewProps) {
  const visible = cell.events.slice(0, 3);
  const overflow = cell.events.length - visible.length;

  return (
    <div
      className={cn(
        "group/cell flex min-h-[110px] flex-col gap-1 px-2 pb-2 pt-1.5",
        !cell.isCurrentMonth && "bg-secondary/20",
        cell.isWeekend && cell.isCurrentMonth && "bg-secondary/30",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex h-6 min-w-[24px] items-center justify-center rounded-md text-xs font-semibold num",
            cell.isToday
              ? "bg-primary px-1.5 text-primary-foreground"
              : cell.isCurrentMonth
              ? "text-foreground"
              : "text-muted-foreground/60",
          )}
        >
          {cell.dayNumber}
        </span>

        {cell.events.length > 0 && (
          <span className="rounded-full bg-secondary/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground num">
            {cell.events.length}
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-1">
        {visible.map((e) => (
          <EventChip key={e.id} event={e} onClick={() => onEventClick(e)} />
        ))}
        {overflow > 0 && (
          <li className="text-[10px] font-medium text-muted-foreground">+{overflow} autres</li>
        )}
      </ul>
    </div>
  );
}

interface EventChipProps {
  event: CalendarEvent;
  onClick: () => void;
}

function EventChip({ event, onClick }: EventChipProps) {
  const v = EVENT_VISUALS[event.type];
  const compact = event.amount && event.amount >= 1_000_000
    ? formatGNF(event.amount, { compact: true })
    : event.amount
    ? formatGNF(event.amount)
    : null;

  const isYourTurn = event.type === "your-turn";

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group/chip flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition",
          v.bg,
          isYourTurn ? "ring-1 ring-accent-300" : "hover:brightness-95",
        )}
      >
        <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", v.dot)} />
        <span className={cn("min-w-0 flex-1 truncate text-[10.5px] font-medium", v.fg)}>
          {event.time && <span className="mr-1 num">{event.time}</span>}
          <span className={cn(isYourTurn && "font-semibold")}>{event.title}</span>
        </span>
        {compact && (
          <span className={cn("shrink-0 text-[10px] font-semibold num", v.fg)}>
            {compact}
          </span>
        )}
      </button>
    </li>
  );
}
