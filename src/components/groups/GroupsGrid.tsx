import { ArrowRight, Calendar, Sparkles, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import type { TontineGroup } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

export function GroupsGrid({ groups }: { groups: TontineGroup[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <GroupGridCard key={g.id} group={g} />
      ))}
    </div>
  );
}

function GroupGridCard({ group }: { group: TontineGroup }) {
  const turnsCompleted = Math.round((group.progress / 100) * group.members);
  const isYourTurn = group.status === "your-turn";
  const isPending = group.status === "pending";
  const isCompleted = group.status === "completed";

  return (
    <article
      className={cn(
        "flex flex-col rounded-xl border border-hairline bg-card transition hover:border-primary/40",
        isYourTurn && "ring-1 ring-accent-300",
      )}
    >
      <header className="flex items-start gap-3 px-5 pt-5">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-primary-foreground",
            isYourTurn ? "bg-accent-600" : "bg-primary",
          )}
        >
          <Users className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-base font-bold text-foreground">{group.name}</h3>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={group.status} />
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.role === "organizer" ? "Organisateur" : "Participant"}
            </span>
          </div>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 px-5 pt-5 text-sm">
        <Field label="Membres" value={String(group.members)} />
        <Field label="Fréquence" value={group.frequency} />
        <Field
          label="Cotisation"
          value={
            <>
              <span className="num">{formatGNF(group.contribution)}</span>
              <span className="ml-1 text-[11px] text-muted-foreground">GNF</span>
            </>
          }
        />
        <Field
          label="Cagnotte"
          value={
            group.totalCollected > 0 ? (
              <>
                <span className={cn("num", isYourTurn ? "text-accent-700" : "text-foreground")}>
                  {formatGNF(group.totalCollected)}
                </span>
                <span className="ml-1 text-[11px] text-muted-foreground">GNF</span>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
        />
      </dl>

      <div className="px-5 pt-5">
        <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>Progression</span>
          <span className="num text-foreground">
            {turnsCompleted}/{group.members} tours · {group.progress}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full",
              isYourTurn ? "bg-accent-500" : isCompleted ? "bg-muted-foreground/40" : "bg-primary",
            )}
            style={{ width: `${group.progress}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-hairline px-5 py-4">
        <div className="min-w-0 flex-1">
          {isPending ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Inscription en cours
            </p>
          ) : isCompleted ? (
            <p className="text-xs text-muted-foreground">Cycle clôturé</p>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-xs">
              <Calendar
                className={cn(
                  "h-3.5 w-3.5",
                  group.daysToDeadline !== undefined && group.daysToDeadline <= 3 ? "text-destructive" : "text-muted-foreground",
                )}
              />
              <span className="text-foreground">{group.nextPaymentDate}</span>
              {group.daysToDeadline !== undefined && (
                <span
                  className={cn(
                    "ml-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium",
                    group.daysToDeadline <= 3 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {formatRelativeDays(group.daysToDeadline)}
                </span>
              )}
            </p>
          )}
        </div>
        <Link
          to={`/groupes/${group.id}`}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition",
            isYourTurn
              ? "bg-accent-600 text-accent-foreground hover:bg-accent-700"
              : "bg-primary text-primary-foreground hover:bg-primary-700",
          )}
        >
          {isYourTurn ? "Recevoir" : isCompleted ? "Voir" : "Détails"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-display text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}
