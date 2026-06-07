import { Calendar, CheckCircle2, Clock, HandCoins } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGNF, getInitials } from "@/lib/format";
import type { DbNextTurn } from "@/lib/api/types";

interface TurnsTimelineProps {
  turns: DbNextTurn[];
  currentUserId: string | null;
}

const STATUS_META: Record<
  string,
  { label: string; dotClass: string; lineClass: string }
> = {
  paid: {
    label: "Versé",
    dotClass: "bg-success text-success-foreground",
    lineClass: "bg-success/50",
  },
  collecting: {
    label: "Collecte en cours",
    dotClass: "bg-accent-600 text-accent-foreground ring-4 ring-accent-100",
    lineClass: "bg-accent-200",
  },
  upcoming: {
    label: "À venir",
    dotClass: "bg-secondary text-muted-foreground",
    lineClass: "bg-border",
  },
  skipped: {
    label: "Sauté",
    dotClass: "bg-muted text-muted-foreground",
    lineClass: "bg-border",
  },
};

function statusIcon(status: string) {
  switch (status) {
    case "paid":
      return <CheckCircle2 className="h-4 w-4" />;
    case "collecting":
      return <HandCoins className="h-4 w-4" />;
    case "upcoming":
      return <Clock className="h-4 w-4" />;
    default:
      return <Calendar className="h-4 w-4" />;
  }
}

export function TurnsTimeline({ turns, currentUserId }: TurnsTimelineProps) {
  if (turns.length === 0) {
    return (
      <p className="px-5 py-8 text-sm text-muted-foreground lg:px-6">
        Le cycle n'a pas encore démarré. Les tours apparaîtront ici une fois la
        rotation lancée.
      </p>
    );
  }

  return (
    <ol className="relative px-5 py-5 lg:px-6">
      {turns.map((t, i) => {
        const meta = STATUS_META[t.status] ?? STATUS_META.upcoming;
        const isLast = i === turns.length - 1;
        const isYou = t.beneficiary_user_id === currentUserId;
        const dueLabel = new Date(t.due_date).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
        const initials = getInitials(t.beneficiary_name ?? "··");

        return (
          <li key={t.turn_id} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[18px] top-9 h-[calc(100%-2.25rem)] w-px",
                  meta.lineClass,
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[11px] font-bold",
                meta.dotClass,
              )}
              aria-label={meta.label}
            >
              {statusIcon(t.status)}
            </span>
            <div
              className={cn(
                "flex flex-1 flex-wrap items-center gap-3 rounded-lg border px-4 py-3",
                t.status === "collecting"
                  ? "border-accent-200 bg-accent-50/60"
                  : t.status === "paid"
                    ? "border-success/30 bg-success/5"
                    : "border-hairline bg-card",
              )}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-background text-xs font-bold text-foreground">
                {initials || "··"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    Tour #{t.turn_number} ·{" "}
                    {t.beneficiary_name ?? "Membre"}
                  </p>
                  {isYou && (
                    <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-700">
                      Vous
                    </span>
                  )}
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {dueLabel} · {meta.label}
                </p>
              </div>
              <p className="font-display text-sm font-bold text-foreground num">
                {formatGNF(t.payout_amount, { withCurrency: true })}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}