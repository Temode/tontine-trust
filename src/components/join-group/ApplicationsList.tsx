import { CheckCircle2, Clock, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { JoinApplication, JoinApplicationStatus } from "@/lib/types";

const STATUS_VISUAL: Record<JoinApplicationStatus, { Icon: LucideIcon; tone: string; label: string }> = {
  pending: { Icon: Clock, tone: "bg-warning/10 text-warning", label: "En attente" },
  accepted: { Icon: CheckCircle2, tone: "bg-success/10 text-success", label: "Acceptée" },
  declined: { Icon: X, tone: "bg-destructive/10 text-destructive", label: "Refusée" },
  cancelled: { Icon: X, tone: "bg-muted text-muted-foreground", label: "Annulée" },
};

interface ApplicationsListProps {
  applications: JoinApplication[];
  onCancel?: (id: string) => void;
}

export function ApplicationsList({ applications, onCancel }: ApplicationsListProps) {
  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Mes candidatures</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Suivi des demandes d'adhésion en cours et historiques
          </p>
        </div>
        <span className="hidden rounded-full bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex num">
          {applications.length}
        </span>
      </header>

      {applications.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-muted-foreground">
          Aucune candidature pour le moment. Saisissez un code ou choisissez un groupe dans l'annuaire.
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {applications.map((app) => {
            const v = STATUS_VISUAL[app.status];
            const Icon = v.Icon;
            return (
              <li key={app.id} className="px-5 py-4 lg:px-6">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                      v.tone,
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{app.groupName}</p>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", v.tone)}>
                        {v.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      Émetteur : <span className="text-foreground">{app.organizerName}</span> ·
                      Cotisation <span className="font-medium text-foreground num">
                        {" "}
                        {formatGNF(app.contribution, { withCurrency: true })}
                      </span>{" "}
                      · {app.members} membres
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Soumis le <span className="text-foreground">{app.appliedOn}</span>
                    </p>

                    {app.message && (
                      <p
                        className={cn(
                          "mt-2 rounded-md border-l-2 px-3 py-2 text-xs",
                          app.status === "declined"
                            ? "border-destructive/40 bg-destructive/5 text-destructive"
                            : app.status === "accepted"
                            ? "border-success/40 bg-success/5 text-foreground"
                            : "border-primary-100 bg-primary-50/40 text-foreground",
                        )}
                      >
                        « {app.message} »
                      </p>
                    )}
                  </div>
                </div>

                {app.status === "pending" && onCancel && (
                  <div className="mt-3 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => onCancel(app.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                      Retirer la candidature
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
