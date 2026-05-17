import { ArrowDownCircle, ArrowUpCircle, TrendingUp, Wallet } from "lucide-react";
import { formatGNF } from "@/lib/format";

interface PrimaryBalanceProps {
  amount: number;
  monthlyChange: number;
  monthlyTrend: number;
}

export function PrimaryBalanceCard({ amount, monthlyChange, monthlyTrend }: PrimaryBalanceProps) {
  return (
    <article className="relative col-span-2 overflow-hidden rounded-xl bg-primary p-6 text-primary-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary-100/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary-100/80">Solde total des tontines</p>
            <p className="mt-3 font-display text-4xl font-bold leading-none num">
              {formatGNF(amount)}
              <span className="ml-2 text-lg font-medium text-primary-100/70">GNF</span>
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-foreground/10">
            <Wallet className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-6 border-t border-primary-foreground/10 pt-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-primary-100/70">Ce mois</p>
            <p className="mt-1 font-display text-base font-semibold num">
              +{formatGNF(monthlyChange)} GNF
            </p>
          </div>
          <div className="h-8 w-px bg-primary-foreground/15" aria-hidden />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-primary-100/70">Évolution</p>
            <p className="mt-1 inline-flex items-center gap-1 font-display text-base font-semibold text-success-foreground/95">
              <TrendingUp className="h-4 w-4" />
              <span className="num">+{monthlyTrend.toFixed(1)}%</span>
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

interface StatTileProps {
  variant: "out" | "in";
  label: string;
  primary: string;
  secondary: string;
  badge: string;
}

export function StatTile({ variant, label, primary, secondary, badge }: StatTileProps) {
  const isIn = variant === "in";
  const Icon = isIn ? ArrowDownCircle : ArrowUpCircle;
  const tone = isIn
    ? "bg-accent-50 text-accent-700"
    : "bg-success/10 text-success";
  const badgeTone = isIn
    ? "bg-accent-50 text-accent-700"
    : "bg-success/10 text-success";

  return (
    <article className="rounded-xl border border-hairline bg-card p-6">
      <div className="mb-4 flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeTone}`}>{badge}</span>
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-foreground num">{primary}</p>
      <p className="mt-2 text-xs text-muted-foreground">{secondary}</p>
    </article>
  );
}
