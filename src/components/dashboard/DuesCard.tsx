import { Link } from "react-router-dom";
import { Wallet, ChevronRight } from "lucide-react";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { formatGNF } from "@/lib/format";
import type { DbContributionDue } from "@/lib/api/contributions";

interface Props {
  dues: DbContributionDue[];
  isLoading?: boolean;
}

function dueLabel(days: number) {
  if (days < 0) return `En retard de ${Math.abs(days)} j`;
  if (days === 0) return "À régler aujourd'hui";
  if (days === 1) return "Échéance demain";
  return `Dans ${days} jours`;
}

export function DuesCard({ dues, isLoading }: Props) {
  const top = dues.slice(0, 3);
  return (
    <SectionCard
      title="À payer"
      subtitle={isLoading ? "Chargement…" : `${dues.length} cotisation${dues.length > 1 ? "s" : ""} due${dues.length > 1 ? "s" : ""}`}
      action={dues.length > 0 ? { label: "Tout voir", href: "/cotisations" } : undefined}
      bare
    >
      {isLoading ? (
        <p className="px-5 py-6 text-sm text-muted-foreground lg:px-6">Chargement…</p>
      ) : top.length === 0 ? (
        <div className="px-5 py-8 text-center lg:px-6">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success">
            <Wallet className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-foreground">Vous êtes à jour</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Aucune cotisation due pour le moment.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {top.map((d) => {
            const late = d.days_to_due < 0;
            return (
              <li key={d.contribution_id}>
                <Link
                  to="/cotisations"
                  className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-secondary/40 lg:px-6"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${late ? "bg-destructive/10 text-destructive" : "bg-primary-50 text-primary"}`}>
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {d.group_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tour #{d.turn_number} · pour {d.beneficiary_name ?? "le bénéficiaire"} · {dueLabel(d.days_to_due)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-sm font-bold text-foreground num">
                      {formatGNF(d.amount, { withCurrency: true })}
                    </p>
                    {d.expected_penalty > 0 && (
                      <p className="text-[11px] text-destructive num">
                        + {formatGNF(d.expected_penalty)} pénalité
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}