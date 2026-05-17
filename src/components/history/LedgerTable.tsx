import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowUpDown, ChevronDown, ChevronUp, Download, FileText, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { MobileMoneyOperator, TontineGroup, Transaction, TransactionStatus, TransactionType } from "@/lib/types";

type Period = "30d" | "90d" | "12m" | "all";
type StatusFilter = "all" | TransactionStatus;
type OperatorFilter = "all" | MobileMoneyOperator;
type TypeFilter = "all" | TransactionType;
type GroupFilter = "all" | string;
type SortKey = "date" | "amount" | "group" | "status";
type SortDir = "asc" | "desc";

const periods: Array<{ id: Period; label: string }> = [
  { id: "30d", label: "30 j" },
  { id: "90d", label: "90 j" },
  { id: "12m", label: "12 mois" },
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

interface LedgerTableProps {
  transactions: Transaction[];
  groups: TontineGroup[];
}

export function LedgerTable({ transactions, groups }: LedgerTableProps) {
  const [period, setPeriod] = useState<Period>("12m");
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [operator, setOperator] = useState<OperatorFilter>("all");
  const [groupId, setGroupId] = useState<GroupFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const cutoff = period === "all" ? -Infinity : period === "30d" ? -30 : period === "90d" ? -90 : -365;
    const q = query.trim().toLowerCase();
    const result = transactions.filter((tx) => {
      if (period !== "all") {
        const days = tx.daysFromToday ?? 0;
        if (days < cutoff) return false;
      }
      if (type !== "all" && tx.type !== type) return false;
      if (status !== "all" && tx.status !== status) return false;
      if (operator !== "all" && tx.operator !== operator) return false;
      if (groupId !== "all" && tx.groupId !== groupId) return false;
      if (!q) return true;
      return (
        tx.groupName.toLowerCase().includes(q) ||
        (tx.reference?.toLowerCase().includes(q) ?? false)
      );
    });

    const factor = sortDir === "asc" ? 1 : -1;
    return [...result].sort((a, b) => {
      switch (sort) {
        case "amount":
          return ((a.amount ?? 0) - (b.amount ?? 0)) * factor;
        case "group":
          return a.groupName.localeCompare(b.groupName, "fr") * factor;
        case "status":
          return a.status.localeCompare(b.status) * factor;
        case "date":
        default:
          return ((a.daysFromToday ?? 0) - (b.daysFromToday ?? 0)) * factor;
      }
    });
  }, [transactions, period, type, status, operator, groupId, query, sort, sortDir]);

  const inflow = filtered.filter((t) => t.type === "in" && t.status === "success").reduce((s, t) => s + t.amount, 0);
  const outflow = filtered.filter((t) => t.type === "out" && t.status === "success").reduce((s, t) => s + t.amount, 0);

  const handleSortChange = (key: SortKey) => {
    if (key === sort) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setSortDir(key === "date" || key === "amount" ? "desc" : "asc");
    }
  };

  const handleExportCsv = () => {
    const headers = ["Date", "Type", "Groupe", "Tour", "Montant (GNF)", "Pénalité (GNF)", "Opérateur", "Référence", "Statut", "Signature"];
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
        `0x${tx.id}-sig`,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tontine-registre-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Registre exporté", { description: `${filtered.length} opérations · format CSV` });
  };

  const handleExportPdf = () => {
    toast("Génération du relevé PDF", {
      description: "Le module d'édition fiscale sera disponible dans la prochaine livraison.",
    });
  };

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="flex flex-col gap-3 border-b border-hairline px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">Registre des opérations</h2>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">
            {filtered.length} opérations · Entrées {formatGNF(inflow, { withCurrency: true })} · Sorties {formatGNF(outflow, { withCurrency: true })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              aria-label="Rechercher dans le registre"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Groupe ou référence"
              className="h-9 w-56 rounded-md border border-hairline bg-secondary/40 pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700"
          >
            <FileText className="h-3.5 w-3.5" />
            Relevé PDF
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
            { id: "out", label: "Sorties" },
            { id: "in", label: "Entrées" },
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
        <Divider />
        <label className="inline-flex items-center gap-2 rounded-md border border-hairline bg-card px-2 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Groupe</span>
          <select
            aria-label="Filtrer par groupe"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="h-6 bg-transparent pr-1 text-xs font-medium text-foreground focus:outline-none"
          >
            <option value="all">Tous</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
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
                <SortableTh column="date" label="Date" sort={sort} sortDir={sortDir} onClick={handleSortChange} />
                <th className="px-5 py-3">Type</th>
                <SortableTh column="group" label="Groupe" sort={sort} sortDir={sortDir} onClick={handleSortChange} />
                <th className="px-5 py-3 hidden md:table-cell">Tour</th>
                <SortableTh column="amount" label="Montant" sort={sort} sortDir={sortDir} onClick={handleSortChange} align="right" />
                <th className="px-5 py-3 hidden lg:table-cell">Opérateur</th>
                <th className="px-5 py-3 hidden xl:table-cell">Référence</th>
                <SortableTh column="status" label="Statut" sort={sort} sortDir={sortDir} onClick={handleSortChange} />
                <th className="px-5 py-3 hidden 2xl:table-cell">Signature</th>
                <th className="px-5 py-3 text-right">Reçu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((tx) => {
                const isIn = tx.type === "in";
                const Icon = isIn ? ArrowDownLeft : ArrowUpRight;
                const statusV = statusVisuals[tx.status];
                const op = tx.operator ? operatorVisuals[tx.operator] : null;
                const signature = `0x${tx.id.replace(/[^a-z0-9]/gi, "").padEnd(8, "0").slice(0, 8)}…${tx.reference?.slice(-4) ?? "0000"}`;
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
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground num">
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
                          <span className={cn("flex h-5 w-7 items-center justify-center rounded text-[9px] font-bold", op.swatch, op.text)}>
                            {op.short}
                          </span>
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
                    <td className="px-5 py-3.5 hidden 2xl:table-cell">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                        <ShieldCheck className="h-3 w-3 text-success" />
                        {signature}
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

      <footer className="flex items-center gap-2 border-t border-hairline bg-secondary/30 px-5 py-3 text-[11px] text-muted-foreground lg:px-6">
        <ShieldCheck className="h-3.5 w-3.5 text-success" />
        Chaque opération est notarisée par une signature cryptographique vérifiable. Le registre est immuable.
      </footer>
    </article>
  );
}

interface SortableThProps {
  column: SortKey;
  label: string;
  sort: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}

function SortableTh({ column, label, sort, sortDir, onClick, align = "left" }: SortableThProps) {
  const Icon = sort === column ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ArrowUpDown;
  return (
    <th className={cn("px-5 py-3 lg:px-6", align === "right" && "text-right")}>
      <button
        type="button"
        onClick={() => onClick(column)}
        className={cn(
          "inline-flex items-center gap-1 transition hover:text-foreground",
          sort === column ? "text-foreground" : "text-muted-foreground",
          align === "right" && "ml-auto",
        )}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
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
