import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEventType, CalendarView, TontineGroup } from "@/lib/types";
import { EVENT_TYPES_ORDERED, EVENT_VISUALS } from "./eventVisuals";

const MONTHS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

interface CalendarToolbarProps {
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  cursor: Date;
  onCursorChange: (d: Date) => void;
  onToday: () => void;
  groupId: string;
  onGroupChange: (id: string) => void;
  groups: TontineGroup[];
  selectedTypes: Set<CalendarEventType>;
  onToggleType: (type: CalendarEventType) => void;
}

export function CalendarToolbar({
  view,
  onViewChange,
  cursor,
  onCursorChange,
  onToday,
  groupId,
  onGroupChange,
  groups,
  selectedTypes,
  onToggleType,
}: CalendarToolbarProps) {
  const monthLabel = `${MONTHS_FR[cursor.getMonth()]} ${cursor.getFullYear()}`;

  const goPrev = () => onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () => onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

  return (
    <div className="rounded-xl border border-hairline bg-card">
      <div className="flex flex-col gap-3 border-b border-hairline px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Mois précédent"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-foreground transition hover:bg-secondary"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Aujourd'hui
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Mois suivant"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <h2 className="ml-2 font-display text-lg font-bold tracking-tight text-foreground lg:text-xl">
            {monthLabel}
          </h2>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-md border border-hairline bg-card px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Groupe</span>
            <select
              aria-label="Filtrer par groupe"
              value={groupId}
              onChange={(e) => onGroupChange(e.target.value)}
              className="h-6 bg-transparent pr-1 text-xs font-medium text-foreground focus:outline-none"
            >
              <option value="all">Tous</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-0.5 rounded-md border border-hairline bg-card p-0.5">
            <ViewButton current={view} target="month" onClick={onViewChange} icon={LayoutGrid} label="Mois" />
            <ViewButton current={view} target="agenda" onClick={onViewChange} icon={ListOrdered} label="Agenda" />
          </div>
        </div>
      </div>

      {/* Type toggle row */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 lg:px-5">
        <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:inline">
          Types
        </span>
        {EVENT_TYPES_ORDERED.map((t) => {
          const v = EVENT_VISUALS[t];
          const active = selectedTypes.has(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => onToggleType(t)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                active
                  ? "border-foreground/15 bg-card text-foreground"
                  : "border-hairline bg-secondary/40 text-muted-foreground hover:text-foreground",
              )}
            >
              <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", active ? v.dot : "bg-muted-foreground/30")} />
              {v.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ViewButtonProps {
  current: CalendarView;
  target: CalendarView;
  onClick: (v: CalendarView) => void;
  icon: typeof LayoutGrid;
  label: string;
}

function ViewButton({ current, target, onClick, icon: Icon, label }: ViewButtonProps) {
  const active = current === target;
  return (
    <button
      type="button"
      onClick={() => onClick(target)}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded px-2 text-xs font-medium transition",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
