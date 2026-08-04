import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, ArrowUpRight, Loader2, Receipt, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import { listMyContributionsDue, type DbContributionDue } from "@/lib/api/contributions";
import { launchDjomyCheckout } from "@/lib/payment/launchDjomyCheckout";

export function PayContributionsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { data: dues = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["contributions", "due"],
    queryFn: listMyContributionsDue,
    enabled: open,
    staleTime: 15_000,
  });

  const sorted = useMemo(
    () => [...dues].sort((a, b) => a.days_to_due - b.days_to_due),
    [dues],
  );
  const totalDue = useMemo(() => sorted.reduce((s, d) => s + d.amount, 0), [sorted]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-hairline px-6 pb-4 pt-6 text-left">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              <Receipt className="h-3 w-3" />
              Mes cotisations
            </span>
            <DialogTitle className="mt-2 font-display text-2xl font-bold tracking-tight">
              À régler maintenant
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Réglez en quelques secondes via Orange Money, MoMo ou carte.
            </DialogDescription>
          </DialogHeader>

          {/* Total */}
          <div className="flex items-center justify-between border-b border-hairline bg-secondary/30 px-6 py-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Total dû
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground num">
                {formatGNF(totalDue)} <span className="text-xs font-semibold text-muted-foreground">GNF</span>
              </p>
            </div>
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <ul className="divide-y divide-hairline">
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-3 px-6 py-3.5">
                    <div className="h-10 w-1 shrink-0 rounded-full bg-secondary" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3.5 w-1/2 animate-pulse rounded bg-secondary" />
                      <div className="h-2.5 w-1/3 animate-pulse rounded bg-secondary/70" />
                    </div>
                    <div className="h-4 w-20 animate-pulse rounded bg-secondary" />
                    <div className="h-9 w-16 animate-pulse rounded-lg bg-secondary" />
                  </li>
                ))}
              </ul>
            ) : isError ? (
              <div className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-bold text-foreground">Impossible de charger vos cotisations</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {error instanceof Error ? error.message : "Erreur réseau."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="inline-flex h-9 items-center rounded-lg border border-hairline bg-card px-3 text-xs font-medium text-foreground transition hover:bg-secondary"
                >
                  Réessayer
                </button>
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <p className="font-display text-base font-bold text-foreground">Vous êtes à jour.</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Aucune cotisation due actuellement. Les prochaines échéances apparaîtront ici.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {sorted.map((d) => (
                  <DueRow
                    key={d.contribution_id}
                    due={d}
                    onPay={() => {
                      onOpenChange(false);
                      void launchDjomyCheckout(d.contribution_id);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>

          <footer className="flex items-center justify-between gap-2 border-t border-hairline bg-card/60 px-6 py-3">
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                navigate("/cotisations");
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              Voir la page complète
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 items-center rounded-lg border border-hairline bg-card px-4 text-sm font-medium text-foreground transition hover:bg-secondary"
            >
              Fermer
            </button>
          </footer>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DueRow({ due, onPay }: { due: DbContributionDue; onPay: () => void }) {
  const urgent = due.days_to_due <= 3;
  return (
    <li className="flex items-center gap-3 px-6 py-3.5">
      <div
        aria-hidden
        className={cn(
          "h-10 w-1 shrink-0 rounded-full",
          urgent ? "bg-destructive" : due.days_to_due <= 7 ? "bg-accent" : "bg-primary",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-semibold text-foreground">{due.group_name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Tour #{due.turn_number} ·{" "}
          <span className={urgent ? "font-medium text-destructive" : ""}>
            {formatRelativeDays(due.days_to_due)}
          </span>
        </p>
      </div>
      <div className="text-right">
        <p className="font-display text-sm font-bold text-foreground num">
          {formatGNF(due.amount)} <span className="text-[11px] font-medium text-muted-foreground">GNF</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onPay}
        className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700"
      >
        Payer
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}