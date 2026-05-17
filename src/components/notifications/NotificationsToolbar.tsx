import { CheckCheck, Search, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { NotificationCategory } from "@/lib/types";
import { CATEGORY_VISUALS } from "./notificationVisuals";

export type NotificationFilter =
  | "all"
  | "unread"
  | "action"
  | NotificationCategory;

interface NotificationsToolbarProps {
  filter: NotificationFilter;
  onFilterChange: (f: NotificationFilter) => void;
  query: string;
  onQueryChange: (q: string) => void;
  counts: Record<NotificationFilter, number>;
  onMarkAllRead: () => void;
}

const PRIMARY_FILTERS: Array<{ id: NotificationFilter; label: string }> = [
  { id: "all", label: "Tout" },
  { id: "unread", label: "Non lues" },
  { id: "action", label: "Actions requises" },
];

const CATEGORY_FILTERS: NotificationCategory[] = [
  "financial",
  "governance",
  "security",
  "social",
  "system",
];

export function NotificationsToolbar({
  filter,
  onFilterChange,
  query,
  onQueryChange,
  counts,
  onMarkAllRead,
}: NotificationsToolbarProps) {
  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex flex-col gap-3 border-b border-hairline px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              aria-label="Rechercher dans les notifications"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Titre, groupe ou source"
              className="h-9 w-full rounded-md border border-hairline bg-secondary/40 pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/15 lg:w-72"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onMarkAllRead}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-foreground transition hover:bg-secondary"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Tout marquer lu
          </button>
          <Link
            to="/profil"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Préférences
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline px-5 py-3 lg:px-6">
        {PRIMARY_FILTERS.map((f) => {
          const active = filter === f.id;
          const count = counts[f.id] ?? 0;
          return (
            <Chip
              key={f.id}
              active={active}
              onClick={() => onFilterChange(f.id)}
              label={f.label}
              count={count}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-5 py-3 lg:px-6">
        <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:inline">
          Catégories
        </span>
        {CATEGORY_FILTERS.map((cat) => {
          const v = CATEGORY_VISUALS[cat];
          const active = filter === cat;
          const count = counts[cat] ?? 0;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onFilterChange(cat)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                active
                  ? "border-foreground/15 bg-card text-foreground"
                  : "border-hairline bg-secondary/40 text-muted-foreground hover:text-foreground",
              )}
            >
              <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", v.dot)} />
              {v.label}
              <span className="ml-1 rounded-full bg-secondary px-1.5 text-[10px] font-semibold text-muted-foreground num">
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px] font-semibold num",
          active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-secondary text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}
