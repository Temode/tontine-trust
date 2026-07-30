import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Banknote,
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RotateCcw,
  Search,
  Settings2,
} from "lucide-react";
import {
  CATEGORY_LABEL,
  COMPARTMENT_LABEL,
  fetchTreasuryJournal,
  fetchTreasurySummary,
  fetchWithdrawalFeeConfig,
  updateWithdrawalFeeConfig,
  type Compartment,
  type LedgerCategory,
  type WithdrawalFeeConfig,
} from "@/lib/api/accounting";
import { formatGNF } from "@/lib/format";
import { downloadCsv } from "@/lib/export/csv";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

const CATEGORIES: (LedgerCategory | "all")[] = [
  "all",
  "contribution",
  "payout",
  "sms_pack",
  "subscription",
  "withdrawal_fee",
  "coordinator_fee",
  "refund",
  "adjustment",
];

export default function AdminAccounting() {
  const qc = useQueryClient();
  const [compartment, setCompartment] = useState<Compartment | "all">("all");
  const [category, setCategory] = useState<LedgerCategory | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const summaryQ = useQuery({ queryKey: ["treasury-summary"], queryFn: fetchTreasurySummary });

  const params = useMemo(
    () => ({
      compartment: compartment === "all" ? undefined : compartment,
      category: category === "all" ? undefined : category,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(new Date(to).getTime() + 86400000).toISOString() : undefined,
      search: search || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [compartment, category, from, to, search, page],
  );

  const journalQ = useQuery({
    queryKey: ["treasury-journal", params],
    queryFn: () => fetchTreasuryJournal(params),
  });

  const rows = journalQ.data?.rows ?? [];
  const total = journalQ.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const summary = summaryQ.data ?? [];
  const escrow = summary.filter((s) => s.compartment === "client_escrow");
  const revenue = summary.filter((s) => s.compartment === "platform_revenue");
  const sum = (rowsIn: typeof summary, key: "net" | "net_30d") =>
    rowsIn.reduce((a, r) => a + Number(r[key] ?? 0), 0);

  const exportCsv = async () => {
    const all = await fetchTreasuryJournal({ ...params, limit: 5000, offset: 0 });
    downloadCsv(
      `journal-tresorerie-${new Date().toISOString().slice(0, 10)}.csv`,
      all.rows.map((r) => ({
        date: r.created_at,
        compartiment: COMPARTMENT_LABEL[r.compartment],
        categorie: CATEGORY_LABEL[r.category],
        sens: r.direction === "in" ? "Entrée" : "Sortie",
        montant: r.amount,
        utilisateur: r.user_name ?? "",
        groupe: r.group_name ?? "",
        libelle: r.memo ?? "",
      })),
    );
  };

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-amber-300">Comptabilité & trésorerie</h1>
        <p className="mt-1 text-sm text-slate-400">
          Séparation stricte entre l'argent des clients (cotisations) et les revenus propres de Tontine Digitale.
        </p>
      </header>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <BalanceCard
          icon={<Banknote className="h-5 w-5" />}
          tone="escrow"
          title="Fonds clients sous séquestre"
          subtitle="N'appartient jamais à Tontine Digitale"
          amount={sum(escrow, "net")}
          delta={sum(escrow, "net_30d")}
          breakdown={escrow.map((r) => ({ label: CATEGORY_LABEL[r.category], value: r.net }))}
          loading={summaryQ.isLoading}
        />
        <BalanceCard
          icon={<Building2 className="h-5 w-5" />}
          tone="revenue"
          title="Revenus Tontine Digitale"
          subtitle="SMS, abonnements, frais de retrait, commissions"
          amount={sum(revenue, "net")}
          delta={sum(revenue, "net_30d")}
          breakdown={revenue.map((r) => ({ label: CATEGORY_LABEL[r.category], value: r.net }))}
          loading={summaryQ.isLoading}
        />
      </div>

      <FeeConfigCard onSaved={() => qc.invalidateQueries({ queryKey: ["withdrawal-fee-config"] })} />

      <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900/50">
        <div className="flex flex-wrap items-end gap-2 border-b border-slate-800 p-4">
          <div className="min-w-[220px] flex-1">
            <Label>Recherche (membre, groupe, libellé)</Label>
            <div className="flex gap-2">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (setSearch(searchInput.trim()), setPage(0))}
                placeholder="ex. Aïssatou, Tontine Famille…"
                className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200"
              />
              <button
                onClick={() => { setSearch(searchInput.trim()); setPage(0); }}
                className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                <Search className="h-3 w-3" /> Chercher
              </button>
            </div>
          </div>
          <div>
            <Label>Compartiment</Label>
            <select
              value={compartment}
              onChange={(e) => { setCompartment(e.target.value as Compartment | "all"); setPage(0); }}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
            >
              <option value="all">Tous</option>
              <option value="client_escrow">{COMPARTMENT_LABEL.client_escrow}</option>
              <option value="platform_revenue">{COMPARTMENT_LABEL.platform_revenue}</option>
            </select>
          </div>
          <div>
            <Label>Catégorie</Label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value as LedgerCategory | "all"); setPage(0); }}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c === "all" ? "Toutes" : CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Du</Label>
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200" />
          </div>
          <div>
            <Label>Au</Label>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200" />
          </div>
          <button
            onClick={() => { setCompartment("all"); setCategory("all"); setFrom(""); setTo(""); setSearch(""); setSearchInput(""); setPage(0); }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            <RotateCcw className="h-3 w-3" /> Réinitialiser
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-amber-300"
          >
            <Download className="h-3 w-3" /> Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Compartiment</th>
                <th className="px-4 py-2 text-left">Catégorie</th>
                <th className="px-4 py-2 text-left">Membre / Groupe</th>
                <th className="px-4 py-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {journalQ.isLoading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td></tr>
              )}
              {!journalQ.isLoading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Aucune écriture.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-800/70">
                  <td className="px-4 py-2 text-slate-400">
                    {new Date(r.created_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-2">
                    <span className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-semibold",
                      r.compartment === "client_escrow"
                        ? "bg-teal-400/10 text-teal-300"
                        : "bg-amber-400/10 text-amber-300",
                    )}>
                      {COMPARTMENT_LABEL[r.compartment]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-300">{CATEGORY_LABEL[r.category]}</td>
                  <td className="px-4 py-2 text-slate-400">
                    {r.user_name ?? "—"}
                    {r.group_name ? <span className="text-slate-600"> · {r.group_name}</span> : null}
                  </td>
                  <td className={cn(
                    "px-4 py-2 text-right font-semibold tabular-nums",
                    r.direction === "in" ? "text-emerald-400" : "text-rose-400",
                  )}>
                    {r.direction === "in" ? "+" : "−"} {formatGNF(r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
          <span>{total} écriture{total > 1 ? "s" : ""}</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
              className="rounded border border-slate-700 p-1 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>{page + 1} / {pageCount}</span>
            <button disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-700 p-1 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </label>
  );
}

function BalanceCard(props: {
  icon: React.ReactNode;
  tone: "escrow" | "revenue";
  title: string;
  subtitle: string;
  amount: number;
  delta: number;
  breakdown: { label: string; value: number }[];
  loading: boolean;
}) {
  const accent = props.tone === "escrow" ? "text-teal-300" : "text-amber-300";
  const ring = props.tone === "escrow" ? "border-teal-400/25" : "border-amber-400/25";
  return (
    <div className={cn("rounded-xl border bg-slate-900/60 p-5", ring)}>
      <div className="flex items-center gap-2">
        <span className={accent}>{props.icon}</span>
        <h2 className={cn("text-sm font-semibold", accent)}>{props.title}</h2>
      </div>
      <p className="mt-1 text-xs text-slate-500">{props.subtitle}</p>
      <div className="mt-4 text-3xl font-bold tabular-nums text-slate-100">
        {props.loading ? "…" : formatGNF(props.amount)}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        30 derniers jours : <span className="text-slate-300">{formatGNF(props.delta)}</span>
      </p>
      {props.breakdown.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-slate-800 pt-3 text-xs">
          {props.breakdown.map((b) => (
            <li key={b.label} className="flex justify-between">
              <span className="text-slate-500">{b.label}</span>
              <span className="tabular-nums text-slate-300">{formatGNF(b.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FeeConfigCard({ onSaved }: { onSaved: () => void }) {
  const q = useQuery({ queryKey: ["withdrawal-fee-config"], queryFn: fetchWithdrawalFeeConfig });
  const [draft, setDraft] = useState<WithdrawalFeeConfig | null>(null);
  const cfg = draft ?? q.data ?? null;

  const m = useMutation({
    mutationFn: (c: WithdrawalFeeConfig) => updateWithdrawalFeeConfig(c),
    onSuccess: () => { toast.success("Frais de retrait mis à jour"); setDraft(null); onSaved(); q.refetch(); },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  if (!cfg) return null;
  const patch = (p: Partial<WithdrawalFeeConfig>) => setDraft({ ...cfg, ...p });

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-amber-300" />
        <h2 className="text-sm font-semibold text-amber-300">Frais de retrait</h2>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={cfg.is_active} onChange={(e) => patch({ is_active: e.target.checked })} />
          Frais actifs
        </label>
        <div>
          <Label>Pourcentage (%)</Label>
          <input type="number" step="0.1" min={0} max={100} value={cfg.percent}
            onChange={(e) => patch({ percent: Number(e.target.value) })}
            className="w-28 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200" />
        </div>
        <div>
          <Label>Frais minimum (GNF)</Label>
          <input type="number" min={0} value={cfg.min_fee}
            onChange={(e) => patch({ min_fee: Number(e.target.value) })}
            className="w-32 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200" />
        </div>
        <div>
          <Label>Frais maximum (GNF)</Label>
          <input type="number" min={0} value={cfg.max_fee ?? ""}
            placeholder="illimité"
            onChange={(e) => patch({ max_fee: e.target.value === "" ? null : Number(e.target.value) })}
            className="w-32 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200" />
        </div>
        <button
          disabled={!draft || m.isPending}
          onClick={() => draft && m.mutate(draft)}
          className="rounded-md bg-amber-400 px-4 py-1.5 text-xs font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-40"
        >
          {m.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Les frais sont prélevés sur le montant demandé : le membre reçoit le net, les frais sont comptabilisés en revenus.
      </p>
    </section>
  );
}
