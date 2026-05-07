import { Plus, Receipt, TrendingUp } from "lucide-react";
import { formatGNF } from "@/lib/format";

interface BalanceCardProps {
  amount: number;
  trend?: number;
  onPay?: () => void;
  onHistory?: () => void;
}

export function BalanceCard({ amount, trend = 12.5, onPay, onHistory }: BalanceCardProps) {
  return (
    <div className="rounded-2xl bg-card p-5 shadow-card md:p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Solde total des tontines</p>
          <h2 className="mt-1.5 text-2xl font-bold text-foreground num md:text-3xl">
            <span className="mr-1.5 text-base font-semibold text-accent-600">GNF</span>
            {formatGNF(amount)}
          </h2>
        </div>
        {trend !== undefined && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-semibold text-success">
            <TrendingUp className="h-3 w-3" />
            +{trend.toFixed(1)}%
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPay}
          className="flex h-11 items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-semibold text-white shadow-primary transition hover:opacity-95 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Cotiser
        </button>
        <button
          type="button"
          onClick={onHistory}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-muted text-sm font-semibold text-foreground transition hover:bg-muted/70 active:scale-[0.98]"
        >
          <Receipt className="h-4 w-4" />
          Historique
        </button>
      </div>
    </div>
  );
}
