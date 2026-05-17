import { Star, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { TontineGroup } from "@/lib/types";

interface GroupRowProps {
  group: TontineGroup;
}

export function GroupRow({ group }: GroupRowProps) {
  const isYourTurn = group.status === "your-turn";
  const turnsCompleted = Math.round((group.progress / 100) * group.members);

  return (
    <Link
      to={`/groupes/${group.id}`}
      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/40 lg:px-6 lg:py-5"
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-lg text-primary-foreground",
            isYourTurn ? "bg-accent-600" : "bg-primary",
          )}
        >
          <Users className="h-5 w-5" strokeWidth={1.75} />
        </div>
        {isYourTurn && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-success ring-2 ring-card">
            <Star className="h-2.5 w-2.5 fill-card text-card" strokeWidth={2.5} />
          </span>
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-foreground lg:text-base">{group.name}</h3>
          {isYourTurn ? (
            <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-700">
              Votre tour
            </span>
          ) : group.status === "completed" ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Terminé
            </span>
          ) : (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-success">
              Actif
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {group.members} membres · {group.frequency} · {formatGNF(group.contribution, { withCurrency: true })}
        </p>
        <div className="mt-3 max-w-md">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Progression du cycle</span>
            <span className="font-medium text-foreground num">
              {turnsCompleted}/{group.members} tours
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn("h-full rounded-full", isYourTurn ? "bg-accent-500" : "bg-primary")}
              style={{ width: `${group.progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Right rail */}
      <div className="hidden min-w-[140px] shrink-0 text-right md:block">
        {isYourTurn ? (
          <>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Cagnotte</p>
            <p className="mt-1 font-display text-lg font-bold text-accent-700 num">
              {formatGNF(group.totalCollected, { withCurrency: true })}
            </p>
            <span className="mt-2 inline-flex h-8 items-center rounded-md bg-accent-600 px-3 text-xs font-semibold text-accent-foreground transition group-hover:bg-accent-700">
              Recevoir
            </span>
          </>
        ) : (
          <>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Votre tour</p>
            <p className="mt-1 font-display text-lg font-bold text-foreground num">#{group.yourTurn}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{group.nextPaymentDate}</p>
          </>
        )}
      </div>
    </Link>
  );
}
