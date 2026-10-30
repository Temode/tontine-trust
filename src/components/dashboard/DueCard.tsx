import { ArrowRight, AlertCircle, Clock } from "lucide-react";
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
  /** Date d'échéance (yyyy-mm-dd ou ISO). Sert au label "Disponible le …". */
  dueDate?: string | null;
}

/**
 * Carte « cotisation à payer » façon Paxefy : bord gauche accentué selon urgence,
 * montant en gros, échéance relative, CTA primaire « Payer maintenant ».
 * Si le tour n'est pas encore ouvert (échéance dans le futur), le bouton
 * est désactivé et affiche la date d'ouverture.
 */
export function DueCard({
  contributionId,
  groupName,
  amount,
  daysToDue,
  beneficiaryName,
  turnNumber,
  expectedPenalty = 0,
  dueDate,
}: DueCardProps) {
  const navigate = useNavigate();
  const isOverdue = daysToDue < 0;
  const isUrgent = daysToDue >= 0 && daysToDue <= 2;
  // Règle métier : on ne peut payer qu'à partir du jour de l'échéance.
  const canPayNow = daysToDue <= 0;
  const availableLabel = dueDate
    ? new Date(dueDate.length <= 10 ? `${dueDate}T00:00:00Z` : dueDate).toLocaleDateString(
        "fr-FR",
        { day: "2-digit", month: "long" },
      )
    : null;

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

        {canPayNow ? (
          <button
            type="button"
            onClick={() => navigate(`/cotisations?c=${contributionId}`)}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-primary transition hover:bg-primary-700"
          >
            Payer maintenant
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={availableLabel ? `Paiement ouvert le ${availableLabel}` : undefined}
            className="inline-flex h-11 shrink-0 cursor-not-allowed items-center justify-center gap-1.5 rounded-md border border-hairline bg-muted px-5 text-sm font-semibold text-muted-foreground"
          >
            <Clock className="h-4 w-4" />
            {availableLabel ? `Disponible le ${availableLabel}` : "Pas encore ouvert"}
          </button>
        )}
      </div>
    </article>
  );
}