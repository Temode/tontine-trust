import { Download, LayoutGrid, List, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SORT_OPTIONS, STATUS_FILTERS, type GroupsFilter, type SortKey, type ViewMode } from "./types";

interface GroupsToolbarProps {
  query: string;
  onQueryChange: (q: string) => void;
  filter: GroupsFilter;
  onFilterChange: (f: GroupsFilter) => void;
  counts: Record<GroupsFilter, number>;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  onExport?: () => void;
}

export function GroupsToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  counts,
  sort,
  onSortChange,
  view,
  onViewChange,
  onExport,
}: GroupsToolbarProps) {
  return (
    <div className="rounded-xl border border-hairline bg-card">
      {/* Search + actions */}
      <div className="flex flex-col gap-3 border-b border-hairline px-4 py-3 lg:flex-row lg:items-center lg:px-5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Rechercher un groupe"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Rechercher par nom, membre ou bénéficiaire..."
            className="h-10 w-full rounded-lg border border-hairline bg-secondary/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="hidden items-center gap-2 rounded-lg border border-hairline bg-card px-2 py-1.5 text-sm sm:flex">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Trier</span>
            <select
              aria-label="Trier les groupes"
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortKey)}
              className="h-7 bg-transparent pr-1 text-xs font-medium text-foreground focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-0.5 rounded-lg border border-hairline bg-card p-0.5" role="tablist" aria-label="Vue">
            <ViewToggleButton current={view} target="table" onClick={onViewChange} icon={List} label="Liste" />
            <ViewToggleButton current={view} target="grid" onClick={onViewChange} icon={LayoutGrid} label="Grille" />
          </div>

          {onExport && (
            <button
              type="button"
              onClick={onExport}
              aria-label="Exporter en CSV"
              className="hidden h-9 items-center gap-1.5 rounded-lg border border-hairline px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:inline-flex"
            >
              <Download className="h-4 w-4" />
              Exporter
            </button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1 overflow-x-auto px-4 py-2.5 scrollbar-thin lg:px-5">
        {STATUS_FILTERS.map((f) => {
          const active = filter === f.id;
          const count = counts[f.id];
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilterChange(f.id)}
              aria-pressed={active}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-semibold",
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-secondary text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ViewToggleButtonProps {
  current: ViewMode;
  target: ViewMode;
  onClick: (v: ViewMode) => void;
  icon: typeof List;
  label: string;
}

function ViewToggleButton({ current, target, onClick, icon: Icon, label }: ViewToggleButtonProps) {
  const active = current === target;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      onClick={() => onClick(target)}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition",
        active && "bg-primary text-primary-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
