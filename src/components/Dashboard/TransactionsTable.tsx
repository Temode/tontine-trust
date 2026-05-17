import { ArrowDownLeft, ArrowUpRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { Transaction, TransactionType } from "@/lib/types";

export type Filter = "all" | TransactionType;

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Tout" },
  { id: "out", label: "Cotisations" },
  { id: "in", label: "Versements" },
];

export function TransactionFilters({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-secondary/60 p-1">
      {filters.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onChange(f.id)}
          aria-pressed={value === f.id}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition",
            value === f.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

interface TransactionsTableProps {
  transactions: Transaction[];
  filter: Filter;
}

export function TransactionsTable({ transactions, filter }: TransactionsTableProps) {
  const items = filter === "all" ? transactions : transactions.filter((t) => t.type === filter);

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-hairline text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <th className="px-5 py-3 lg:px-6">Type</th>
            <th className="px-5 py-3 lg:px-6">Groupe</th>
            <th className="px-5 py-3 lg:px-6 text-right">Montant</th>
            <th className="px-5 py-3 lg:px-6">Date</th>
            <th className="px-5 py-3 lg:px-6">Statut</th>
            <th className="px-5 py-3 lg:px-6 sr-only">Reçu</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {items.map((tx) => {
            const isIn = tx.type === "in";
            const Icon = isIn ? ArrowDownLeft : ArrowUpRight;
            return (
              <tr key={tx.id} className="text-sm transition-colors hover:bg-secondary/40">
                <td className="px-5 py-3.5 lg:px-6">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md",
                        isIn ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-medium text-foreground">{isIn ? "Reçu" : "Payé"}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground lg:px-6">{tx.groupName}</td>
                <td
                  className={cn(
                    "px-5 py-3.5 text-right font-display font-semibold num lg:px-6",
                    isIn ? "text-success" : "text-foreground",
                  )}
                >
                  {isIn ? "+" : "−"}
                  {formatGNF(tx.amount, { withCurrency: true })}
                </td>
                <td className="px-5 py-3.5 text-muted-foreground lg:px-6">{tx.date}</td>
                <td className="px-5 py-3.5 lg:px-6">
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                    Complété
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right lg:px-6">
                  <button
                    type="button"
                    aria-label={`Télécharger le reçu ${tx.id}`}
                    className="rounded-md p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {items.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">Aucune transaction pour ce filtre.</p>
      )}
    </div>
  );
}

