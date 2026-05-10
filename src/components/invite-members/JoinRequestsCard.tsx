import { Check, ShieldCheck, Sparkles, Star, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatRelativeDays } from "@/lib/format";
import type { JoinRequest } from "@/lib/types";

interface JoinRequestsCardProps {
  requests: JoinRequest[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function JoinRequestsCard({ requests, onApprove, onReject }: JoinRequestsCardProps) {
  const [decided, setDecided] = useState<Record<string, "approved" | "rejected">>({});

  const sorted = useMemo(
    () => [...requests].sort((a, b) => b.applicantScore - a.applicantScore),
    [requests],
  );

  const handleApprove = (req: JoinRequest) => {
    setDecided((prev) => ({ ...prev, [req.id]: "approved" }));
    onApprove?.(req.id);
    toast.success("Adhésion approuvée", {
      description: `${req.applicantName} a été ajouté(e) au groupe.`,
    });
  };

  const handleReject = (req: JoinRequest) => {
    setDecided((prev) => ({ ...prev, [req.id]: "rejected" }));
    onReject?.(req.id);
    toast(`Demande refusée`, { description: `${req.applicantName} a été notifié(e).` });
  };

  const pendingCount = sorted.filter((r) => !decided[r.id]).length;

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Demandes d'adhésion</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Candidats spontanés via lien public ou annuaire
          </p>
        </div>
        <span className="hidden rounded-full bg-warning/10 px-2 py-1 text-[11px] font-medium text-warning sm:inline-flex num">
          {pendingCount} en attente
        </span>
      </header>

      {sorted.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-muted-foreground">
          Aucune candidature spontanée. Les invitations directes apparaissent dans le carnet d'invités.
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {sorted.map((req) => {
            const decision = decided[req.id];
            return (
              <li key={req.id} className="px-5 py-4 lg:px-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                    {req.applicantInitials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{req.applicantName}</p>
                      <ScoreBadge score={req.applicantScore} />
                      {req.cold && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          <Sparkles className="h-3 w-3" />
                          Annuaire
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      <span className="font-mono">{req.applicantPhone}</span>
                      <span className="mx-1.5">·</span>
                      Demande {formatRelativeDays(req.daysFromToday)}
                    </p>

                    {req.message && (
                      <p className="mt-2 rounded-md border-l-2 border-primary-100 bg-primary-50/40 px-3 py-2 text-xs text-foreground">
                        « {req.message} »
                      </p>
                    )}
                  </div>
                </div>

                {!decision ? (
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleReject(req)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                      Refuser
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(req)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approuver
                    </button>
                  </div>
                ) : (
                  <p
                    className={cn(
                      "mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium",
                      decision === "approved" ? "text-success" : "text-destructive",
                    )}
                  >
                    {decision === "approved" ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    {decision === "approved" ? "Approuvé · candidat ajouté" : "Refusé · candidat notifié"}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <footer className="flex items-center gap-2 border-t border-hairline bg-secondary/30 px-5 py-3 text-[11px] text-muted-foreground lg:px-6">
        <ShieldCheck className="h-3.5 w-3.5 text-success" />
        Décisions horodatées · le candidat est notifié sous 60 secondes
      </footer>
    </article>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 95
      ? "bg-success/10 text-success"
      : score >= 80
      ? "bg-primary-50 text-primary"
      : score >= 70
      ? "bg-warning/10 text-warning"
      : "bg-destructive/10 text-destructive";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tone,
      )}
    >
      <Star className="h-3 w-3" />
      <span className="num">{score}%</span>
    </span>
  );
}
