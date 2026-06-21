import { ArrowRight, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DueCardProps {
  contributionId: string;
  groupName: string;
  amount: number;
  daysToDue: number;
  beneficiaryName?: string | null;
  turnNumber: number;
  expectedPenalty?: number;
}

/**
 * Carte « cotisation à payer » façon Paxefy : bord gauche accentué selon urgence,
 * montant en gros, échéance relative, CTA primaire « Payer maintenant ».
 */
export function DueCard({
  contributionId,
  groupName,
  amount,
  daysToDue,
  beneficiaryName,
  turnNumber,
  expectedPenalty = 0,
}: DueCardProps) {
  const navigate = useNavigate();
  const isOverdue = daysToDue < 0;
  const isUrgent = daysToDue >= 0 && daysToDue <= 2;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card transition",
        "border-hairline hover:border-primary/40",
        isOverdue && "border-l-4 border-l-destructive",
        isUrgent && "border-l-4 border-l-accent",
      )}
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isOverdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                <AlertCircle className="h-3 w-3" /> En retard
              </span>
            )}
            {isUrgent && !isOverdue && (
              <span className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                Bientôt
              </span>
            )}
            <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
              {groupName} · Tour #{turnNumber}
            </p>
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold text-foreground num">
            {formatGNF(amount)} <span className="text-base font-semibold text-muted-foreground">GNF</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {beneficiaryName ? `Pour ${beneficiaryName} · ` : ""}
            <span
              className={cn(
                "font-medium",
                isOverdue && "text-destructive",
                isUrgent && !isOverdue && "text-accent-foreground",
              )}
            >
              {formatRelativeDays(daysToDue)}
            </span>
            {expectedPenalty > 0 && (
              <span className="text-destructive">
                {" · "}
                pénalité {formatGNF(expectedPenalty)} GNF
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/cotisations?c=${contributionId}`)}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-primary transition hover:bg-primary-700"
        >
          Payer maintenant
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </article>
  );
}