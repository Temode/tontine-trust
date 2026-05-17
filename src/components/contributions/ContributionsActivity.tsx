import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { MobileMoneyOperator, Transaction, TransactionStatus, TransactionType } from "@/lib/types";

type Period = "7d" | "30d" | "90d" | "all";
type StatusFilter = "all" | TransactionStatus;
type OperatorFilter = "all" | MobileMoneyOperator;
type TypeFilter = "all" | TransactionType;

const periods: Array<{ id: Period; label: string }> = [
  { id: "7d", label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "90d", label: "90 jours" },
  { id: "all", label: "Tout" },
];

const statusVisuals: Record<TransactionStatus, { label: string; className: string }> = {
  success: { label: "Confirmé", className: "bg-success/10 text-success" },
  pending: { label: "En cours", className: "bg-warning/10 text-warning" },
  failed: { label: "Échoué", className: "bg-destructive/10 text-destructive" },
  scheduled: { label: "Programmé", className: "bg-primary-50 text-primary" },
  late: { label: "En retard", className: "bg-destructive/10 text-destructive" },
};

const operatorVisuals: Record<MobileMoneyOperator, { label: string; swatch: string; text: string; short: string }> = {
  orange: { label: "Orange Money", swatch: "bg-orange-500", text: "text-white", short: "OM" },
  mtn: { label: "MTN Mobile Money", swatch: "bg-yellow-400", text: "text-black", short: "MTN" },
};

interface ContributionsActivityProps {
  transactions: Transaction[];
}

export function ContributionsActivity({ transactions }: ContributionsActivityProps) {
  const [period, setPeriod] = useState<Period>("30d");
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [operator, setOperator] = useState<OperatorFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const periodCutoff = period === "all" ? -Infinity : period === "7d" ? -7 : period === "30d" ? -30 : -90;
    const q = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (period !== "all") {
        const days = tx.daysFromToday ?? 0;
        if (days < periodCutoff) return false;
      }
      if (type !== "all" && tx.type !== type) return false;
      if (status !== "all" && tx.status !== status) return false;
      if (operator !== "all" && tx.operator !== operator) return false;
      if (!q) return true;
      return (
        tx.groupName.toLowerCase().includes(q) ||
        (tx.reference?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [transactions, period, type, status, operator, query]);

  const totalOut = filtered.filter((t) => t.type === "out" && t.status === "success").reduce((s, t) => s + t.amount, 0);
  const totalIn = filtered.filter((t) => t.type === "in" && t.status === "success").reduce((s, t) => s + t.amount, 0);

  const handleExport = () => {
    const headers = [
      "Date",
      "Type",
      "Groupe",
      "Tour",
      "Montant (GNF)",
      "Pénalité (GNF)",
      "Opérateur",
      "Référence",
      "Statut",
    ];
    const rows = filtered.map((tx) =>
      [
        tx.date,
        tx.type === "in" ? "Reçu" : "Cotisation",
        tx.groupName,
        tx.turn ?? "",
        tx.amount,
        tx.penalty ?? 0,
        tx.operator ? operatorVisuals[tx.operator].label : "",
        tx.reference ?? "",
        statusVisuals[tx.status].label,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tontine-cotisations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Export terminé", { description: `${filtered.length} opérations exportées.` });
  };

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex flex-col gap-3 border-b border-hairline px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Activité</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            {filtered.length} opérations · Sortants {formatGNF(totalOut, { withCurrency: true })} · Entrants {formatGNF(totalIn, { withCurrency: true })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              aria-label="Rechercher une opération"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Groupe ou référence"
              className="h-9 w-56 rounded-md border border-hairline bg-secondary/40 pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
            Exporter
          </button>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-5 py-3 text-xs lg:px-6">
        <FilterChips
          label="Période"
          value={period}
          options={periods}
          onChange={(v) => setPeriod(v as Period)}
        />
        <Divider />
        <FilterChips
          label="Type"
          value={type}
          options={[
            { id: "all", label: "Tout" },
            { id: "out", label: "Cotisations" },
            { id: "in", label: "Cagnottes" },
          ]}
          onChange={(v) => setType(v as TypeFilter)}
        />
        <Divider />
        <FilterChips
          label="Statut"
          value={status}
          options={[
            { id: "all", label: "Tout" },
            { id: "success", label: "Confirmés" },
            { id: "failed", label: "Échoués" },
            { id: "pending", label: "En cours" },
          ]}
          onChange={(v) => setStatus(v as StatusFilter)}
        />
        <Divider />
        <FilterChips
          label="Opérateur"
          value={operator}
          options={[
            { id: "all", label: "Tous" },
            { id: "orange", label: "Orange" },
            { id: "mtn", label: "MTN" },
          ]}
          onChange={(v) => setOperator(v as OperatorFilter)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-14 text-center text-sm text-muted-foreground">
          Aucune opération ne correspond à ces filtres.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3 lg:px-6">Date</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Groupe</th>
                <th className="px-5 py-3 hidden md:table-cell">Tour</th>
                <th className="px-5 py-3 text-right">Montant</th>
                <th className="px-5 py-3 hidden lg:table-cell">Opérateur</th>
                <th className="px-5 py-3 hidden xl:table-cell">Référence</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3 text-right">Reçu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((tx) => {
                const isIn = tx.type === "in";
                const Icon = isIn ? ArrowDownLeft : ArrowUpRight;
                const statusV = statusVisuals[tx.status];
                const op = tx.operator ? operatorVisuals[tx.operator] : null;
                return (
                  <tr key={tx.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-5 py-3.5 text-muted-foreground lg:px-6">{tx.date}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-md",
                            isIn ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="font-medium text-foreground">{isIn ? "Cagnotte" : "Cotisation"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-foreground">{tx.groupName}</td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      {tx.turn !== undefined ? (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          #{tx.turn}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={cn("px-5 py-3.5 text-right font-display font-semibold num", isIn ? "text-success" : "text-foreground")}>
                      {isIn ? "+" : "−"}
                      {formatGNF(tx.amount, { withCurrency: true })}
                      {tx.penalty ? (
                        <p className="text-[10px] font-medium text-destructive">
                          dont pénalité {formatGNF(tx.penalty, { withCurrency: true })}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      {op ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={cn("flex h-5 w-7 items-center justify-center rounded text-[9px] font-bold", op.swatch, op.text)}>{op.short}</span>
                          {op.label}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 hidden font-mono text-xs text-muted-foreground xl:table-cell">
                      {tx.reference ?? "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", statusV.className)}>
                        {statusV.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        aria-label={`Télécharger le reçu ${tx.id}`}
                        disabled={tx.status !== "success"}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

interface FilterChipsProps {
  label: string;
  value: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  onChange: (v: string) => void;
}

function FilterChips({ label, value, options, onChange }: FilterChipsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:inline">
        {label}
      </span>
      <div className="flex items-center gap-0.5 rounded-md bg-secondary/60 p-0.5">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.id)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition",
                active ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="hidden h-5 w-px bg-border lg:inline-block" />;
}
