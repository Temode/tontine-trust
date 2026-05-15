import { ArrowUpCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { UsageQuota } from "@/lib/types";

interface LimitsSectionProps {
  quotas: UsageQuota[];
}

export function LimitsSection({ quotas }: LimitsSectionProps) {
  return (
    <div className="space-y-6">
      <article className="rounded-xl border border-hairline bg-card">
        <header className="border-b border-hairline px-5 py-4 lg:px-6">
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Limites & quotas en vigueur</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Plafonds de débit et capacité du compte · ajustables après passage KYC niveau 3
          </p>
        </header>

        <ul className="divide-y divide-border/50">
          {quotas.map((q) => (
            <li key={q.id} className="px-5 py-5 lg:px-6">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{q.label}</p>
                  <p className="mt-0.5 max-w-prose text-xs text-muted-foreground">{q.hint}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-sm font-bold text-foreground num">
                    {q.unit === "currency" ? formatGNF(q.current) : q.current}
                    <span className="ml-1 text-xs font-medium text-muted-foreground">
                      / {q.unit === "currency" ? formatGNF(q.cap) : q.cap}
                      {q.unit === "currency" ? " GNF" : ""}
                    </span>
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Utilisé <span className="num text-foreground">{Math.round((q.current / q.cap) * 100)}%</span>
                  </p>
                </div>
              </div>
              <Bar value={q.current} cap={q.cap} />
              {q.upgradeLevel && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-hairline px-2.5 py-1 text-[11px] text-muted-foreground">
                  <ArrowUpCircle className="h-3.5 w-3.5 text-primary" />
                  <span>
                    Pour relever ce plafond : passer en KYC niveau{" "}
                    <span className="font-semibold text-foreground num">{q.upgradeLevel}</span>.
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      toast("Demande de KYC niveau 3 envoyée", {
                        description: "Le service conformité revient vers vous sous 72h.",
                      })
                    }
                    className="ml-1 font-semibold text-primary transition hover:text-primary-700"
                  >
                    Démarrer
                  </button>
                </p>
              )}
            </li>
          ))}
        </ul>

        <footer className="flex items-center gap-2 border-t border-hairline bg-secondary/30 px-5 py-3 text-[11px] text-muted-foreground lg:px-6">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Tout dépassement déclenche une demande de validation manuelle de la conformité.
        </footer>
      </article>
    </div>
  );
}

function Bar({ value, cap }: { value: number; cap: number }) {
  const rate = Math.min(100, Math.round((value / cap) * 100));
  const tone = rate >= 90 ? "bg-warning" : rate >= 70 ? "bg-accent-500" : "bg-primary";
  return (
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${rate}%` }} />
    </div>
  );
}
