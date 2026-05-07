import { Users } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { TontineGroup } from "@/lib/types";

const statusStyles: Record<TontineGroup["status"], { icon: string; bar: string; badge: string | null; badgeLabel: string | null }> = {
  active: {
    icon: "bg-gradient-to-br from-primary-600 to-primary-700",
    bar: "bg-primary",
    badge: null,
    badgeLabel: null,
  },
  "your-turn": {
    icon: "bg-gradient-to-br from-accent-500 to-accent-600",
    bar: "bg-accent-500",
    badge: "bg-accent-100 text-accent-foreground",
    badgeLabel: "Votre tour !",
  },
  completed: {
    icon: "bg-muted",
    bar: "bg-muted-foreground/40",
    badge: "bg-muted text-muted-foreground",
    badgeLabel: "Terminé",
  },
  pending: {
    icon: "bg-muted",
    bar: "bg-muted-foreground/40",
    badge: "bg-muted text-muted-foreground",
    badgeLabel: "En attente",
  },
};

export function GroupCard({ group }: { group: TontineGroup }) {
  const style = statusStyles[group.status];

  return (
    <Link
      to={`/groupes/${group.id}`}
      className="block rounded-2xl bg-card p-3 shadow-soft transition hover:shadow-card md:p-4"
    >
      <div className="flex items-start gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white md:h-12 md:w-12", style.icon)}>
          <Users className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold text-foreground md:text-base">{group.name}</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {group.members} membres · {group.frequency}
              </p>
            </div>
            {style.badge && (
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", style.badge)}>
                {style.badgeLabel}
              </span>
            )}
          </div>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progression</span>
              <span className="font-medium text-foreground num">{group.progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={group.progress} aria-valuemin={0} aria-valuemax={100}>
              <div className={cn("h-full rounded-full transition-[width]", style.bar)} style={{ width: `${group.progress}%` }} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
