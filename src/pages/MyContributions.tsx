import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, ShieldCheck, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  operatorToProvider,
  payContribution,
} from "@/lib/api/payments";
import type { MobileMoneyOperator } from "@/lib/types";

const operators: Array<{
  id: MobileMoneyOperator;
  name: string;
  short: string;
  swatch: string;
  text: string;
}> = [
  { id: "orange", name: "Orange Money", short: "OM", swatch: "bg-orange-500", text: "text-white" },
  { id: "mtn", name: "MTN Mobile Money", short: "MTN", swatch: "bg-yellow-400", text: "text-black" },
];

export default function MyContributions() {
  const qc = useQueryClient();
  const { data: dues = [], isLoading } = useQuery({
    queryKey: ["contributions", "due"],
    queryFn: listMyContributionsDue,
  });
  const { data: history = [] } = useQuery({
    queryKey: ["payments", "history"],
    queryFn: listMyPaymentsHistory,
  });

  const [paying, setPaying] = useState<{ id: string; op: MobileMoneyOperator } | null>(null);

  const mutation = useMutation({
    mutationFn: ({ id, op }: { id: string; op: MobileMoneyOperator }) =>
      payContribution(id, operatorToProvider(op)),
    onSuccess: (_data, vars) => {
      toast.success("Paiement enregistré", {
        description: `Cotisation confirmée via ${vars.op === "orange" ? "Orange Money" : "MTN MoMo"}.`,
      });
      qc.invalidateQueries({ queryKey: ["contributions"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["turns"] });
      setPaying(null);
    },
    onError: (err: Error) => {
      toast.error("Paiement refusé", { description: err.message });
      setPaying(null);
    },
  });

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
          <KpiTile label="Provider" value="Simulation" hint="Djomy à venir" />
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
                  isPaying={paying?.id === d.contribution_id}
                  selectedOp={paying?.id === d.contribution_id ? paying.op : "orange"}
                  loading={mutation.isPending && paying?.id === d.contribution_id}
                  onSelectOp={(op) => setPaying({ id: d.contribution_id, op })}
                  onPay={(op) => {
                    setPaying({ id: d.contribution_id, op });
                    mutation.mutate({ id: d.contribution_id, op });
                  }}
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
  isPaying: boolean;
  selectedOp: MobileMoneyOperator;
  loading: boolean;
  onSelectOp: (op: MobileMoneyOperator) => void;
  onPay: (op: MobileMoneyOperator) => void;
}

function ContributionRow({ due, isPaying, selectedOp, loading, onSelectOp, onPay }: RowProps) {
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-2" role="radiogroup" aria-label="Opérateur">
          {operators.map((op) => {
            const selected = isPaying && selectedOp === op.id;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => onSelectOp(op.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md border-2 px-3 py-1.5 text-xs font-medium transition",
                  selected
                    ? "border-primary bg-primary-50 text-primary-700"
                    : "border-hairline text-muted-foreground hover:border-muted-foreground/30",
                )}
              >
                <span className={cn("flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold", op.swatch, op.text)}>
                  {op.short}
                </span>
                {op.name}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => onPay(isPaying ? selectedOp : "orange")}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {loading ? "Traitement…" : "Payer maintenant"}
        </button>
      </div>
    </li>
  );
}
