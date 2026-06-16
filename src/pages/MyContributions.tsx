import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, ShieldCheck, Check } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  listMyContributionsDue,
  type DbContributionDue,
} from "@/lib/api/contributions";
import {
  listMyPaymentsHistory,
} from "@/lib/api/payments";
import { DjomyPaymentModal } from "@/components/payment/DjomyPaymentModal";

export default function MyContributions() {
  const { data: dues = [], isLoading } = useQuery({
    queryKey: ["contributions", "due"],
    queryFn: listMyContributionsDue,
  });
  const { data: history = [] } = useQuery({
    queryKey: ["payments", "history"],
    queryFn: listMyPaymentsHistory,
  });

  const [payingDue, setPayingDue] = useState<DbContributionDue | null>(null);

  const totalDue = dues.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Mes cotisations"
        subtitle="Réglez vos cotisations Mobile Money en quelques secondes."
      />
      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiTile label="À payer" value={`${formatGNF(totalDue)} GNF`} hint={`${dues.length} cotisation${dues.length > 1 ? "s" : ""}`} />
          <KpiTile label="Paiements réussis" value={String(history.filter((p) => p.status === "succeeded").length)} />
          <KpiTile label="Provider" value="Djomy" hint="OM · MTN · Carte" />
        </div>

        <SectionCard title="À régler" subtitle={isLoading ? "Chargement…" : undefined} bare>
          {isLoading ? (
            <p className="px-5 py-6 text-sm text-muted-foreground lg:px-6">Chargement…</p>
          ) : dues.length === 0 ? (
            <div className="px-5 py-10 text-center lg:px-6">
              <p className="text-sm text-muted-foreground">Aucune cotisation due. Vous êtes à jour 🎉</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {dues.map((d) => (
                <ContributionRow
                  key={d.contribution_id}
                  due={d}
                  onPay={() => setPayingDue(d)}
                />
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Historique" subtitle={`${history.length} paiement${history.length > 1 ? "s" : ""}`} bare>
          {history.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground lg:px-6">Aucun paiement encore.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {history.slice(0, 20).map((p) => (
                <li key={p.payment_id} className="flex items-center gap-3 px-5 py-3.5 lg:px-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-success/10 text-success">
                    <Check className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{p.group_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Tour #{p.turn_number} · {new Date(p.initiated_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <p className="font-display text-sm font-bold text-foreground num">
                    {formatGNF(p.amount)} GNF
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
      {payingDue && (
        <DjomyPaymentModal
          open={!!payingDue}
          onOpenChange={(o) => !o && setPayingDue(null)}
          contributionId={payingDue.contribution_id}
          groupName={payingDue.group_name}
          amount={payingDue.amount}
        />
      )}
    </div>
  );
}

function KpiTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="rounded-xl border border-hairline bg-card p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary-50 text-primary">
        <Wallet className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-foreground num">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </article>
  );
}

interface RowProps {
  due: DbContributionDue;
  onPay: () => void;
}

function ContributionRow({ due, onPay }: RowProps) {
  const urgent = due.days_to_due <= 3;
  return (
    <li className="px-5 py-4 lg:px-6">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg text-xs font-bold",
            urgent ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground",
          )}
        >
          <span className="text-[10px] uppercase">
            {new Date(due.due_date).toLocaleDateString("fr-FR", { month: "short" })}
          </span>
          <span className="font-display text-base leading-none">
            {new Date(due.due_date).getDate()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{due.group_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            Tour #{due.turn_number} · bénéficiaire {due.beneficiary_name ?? "—"} ·{" "}
            {formatRelativeDays(due.days_to_due)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-sm font-bold text-foreground num">
            {formatGNF(due.amount)} <span className="text-xs text-muted-foreground">GNF</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end">
        <button
          type="button"
          onClick={onPay}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Payer via Djomy
        </button>
      </div>
    </li>
  );
}
