import { CheckCircle2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { Turn } from "@/lib/types";

export function CompletedTurnsTable({ turns }: { turns: Turn[] }) {
  const completed = turns
    .filter((t) => t.status === "completed")
    .sort((a, b) => b.daysFromToday - a.daysFromToday); // plus récent d'abord

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Tours réalisés</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            Historique consolidé des cagnottes versées sur l'ensemble de votre portefeuille
          </p>
        </div>
        <span className="hidden rounded-full bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex num">
          {completed.length} entrées
        </span>
      </header>

      {completed.length === 0 ? (
        <div className="px-6 py-14 text-center text-sm text-muted-foreground">
          Aucun tour terminé pour l'instant. Restez patient — votre première cagnotte est devant vous.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3 lg:px-6">Date</th>
                <th className="px-5 py-3">Groupe</th>
                <th className="px-5 py-3">Tour</th>
                <th className="px-5 py-3">Bénéficiaire</th>
                <th className="px-5 py-3 hidden md:table-cell">Contributeurs</th>
                <th className="px-5 py-3 text-right">Cagnotte versée</th>
                <th className="px-5 py-3 hidden sm:table-cell">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {completed.map((t) => (
                <tr key={t.id} className={cn("transition-colors hover:bg-secondary/30", t.isYou && "bg-accent-50/40")}>
                  <td className="px-5 py-3.5 text-muted-foreground lg:px-6">{t.date}</td>
                  <td className="px-5 py-3.5 text-foreground">{t.groupName}</td>
                  <td className="px-5 py-3.5">
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground num">
                      #{t.index}/{t.total}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold",
                          t.isYou ? "bg-accent-600 text-accent-foreground" : "bg-secondary text-foreground",
                        )}
                      >
                        {t.beneficiaryInitials}
                      </span>
                      <span className="text-foreground">{t.beneficiaryName}</span>
                      {t.isYou && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-700">
                          <Trophy className="h-3 w-3" />
                          Vous
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden text-muted-foreground md:table-cell num">
                    {t.contributorsTotal}/{t.contributorsTotal}
                  </td>
                  <td
                    className={cn(
                      "px-5 py-3.5 text-right font-display font-semibold num",
                      t.isYou ? "text-success" : "text-foreground",
                    )}
                  >
                    {t.isYou ? "+" : ""}
                    {formatGNF(t.amount, { withCurrency: true })}
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      Versé
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
