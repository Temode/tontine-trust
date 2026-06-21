import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileCheck2, Printer, ShieldCheck, Search, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { TopBar } from "@/components/layout/TopBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatGNF } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getReceiptById, listMyReceipts, type DbReceipt } from "@/lib/api/payouts";

export default function Receipts() {
  const { id } = useParams<{ id?: string }>();
  if (id) return <ReceiptDetail id={id} />;
  return <ReceiptList />;
}

function ReceiptList() {
  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["receipts", "mine"],
    queryFn: listMyReceipts,
  });

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<"all" | "30" | "90" | "year">("all");

  const groups = useMemo(() => {
    const map = new Map<string, string>();
    receipts.forEach((r) => map.set(r.group_id, r.group_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [receipts]);

  const providers = useMemo(() => {
    const set = new Set<string>();
    receipts.forEach((r) => r.provider && set.add(r.provider));
    return Array.from(set);
  }, [receipts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const cutoff = periodFilter === "30"
      ? now - 30 * 86_400_000
      : periodFilter === "90"
        ? now - 90 * 86_400_000
        : periodFilter === "year"
          ? new Date(new Date().getFullYear(), 0, 1).getTime()
          : 0;
    return receipts.filter((r) => {
      if (groupFilter !== "all" && r.group_id !== groupFilter) return false;
      if (providerFilter !== "all" && r.provider !== providerFilter) return false;
      if (cutoff && new Date(r.issued_at).getTime() < cutoff) return false;
      if (q) {
        const hay = `${r.receipt_number} ${r.group_name} ${r.beneficiary_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [receipts, search, groupFilter, providerFilter, periodFilter]);

  const hasActiveFilters =
    search.trim() !== "" || groupFilter !== "all" || providerFilter !== "all" || periodFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setGroupFilter("all");
    setProviderFilter("all");
    setPeriodFilter("all");
  };

  return (
    <div className="animate-fade-in">
      <TopBar title="Reçus" subtitle="Vos reçus de versement émis par la tontine." />
      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <SectionCard
          title="Mes reçus"
          subtitle={
            isLoading
              ? "Chargement…"
              : hasActiveFilters
                ? `${filtered.length} sur ${receipts.length} reçu${receipts.length > 1 ? "s" : ""}`
                : `${receipts.length} reçu${receipts.length > 1 ? "s" : ""}`
          }
          bare
        >
          <div className="flex flex-col gap-3 border-b border-hairline px-5 py-4 lg:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex h-10 flex-1 items-center">
                <label htmlFor="receipts-search" className="sr-only">Rechercher un reçu</label>
                <Search aria-hidden="true" className="absolute left-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="receipts-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Numéro de reçu, tontine, bénéficiaire…"
                  className="h-full w-full rounded-md border border-hairline bg-card pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                />
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-10 items-center gap-1 whitespace-nowrap rounded-md border border-hairline bg-card px-3 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                >
                  <X className="h-3.5 w-3.5" /> Réinitialiser
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                aria-label="Filtrer par tontine"
                className="h-10 w-full rounded-md border border-hairline bg-card px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 sm:w-auto"
              >
                <option value="all">Toutes tontines</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                aria-label="Filtrer par moyen"
                className="h-10 w-full rounded-md border border-hairline bg-card px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 sm:w-auto"
              >
                <option value="all">Tous moyens</option>
                {providers.map((p) => (
                  <option key={p} value={p}>{providerLabel(p)}</option>
                ))}
              </select>
              <div role="group" aria-label="Filtrer par période d'échéance" className="inline-flex h-10 w-full items-center rounded-md border border-hairline bg-card p-0.5 sm:w-auto">
                {([
                  { k: "all", l: "Tous" },
                  { k: "30", l: "30 j" },
                  { k: "90", l: "90 j" },
                  { k: "year", l: "Cette année" },
                ] as const).map((opt) => {
                  const active = periodFilter === opt.k;
                  return (
                    <button
                      key={opt.k}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPeriodFilter(opt.k)}
                      className={cn(
                        "h-full flex-1 whitespace-nowrap rounded-[5px] px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 sm:flex-none",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {opt.l}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {isLoading ? (
            <p className="px-5 py-6 text-sm text-muted-foreground lg:px-6">Chargement…</p>
          ) : receipts.length === 0 ? (
            <div className="px-5 py-10 text-center lg:px-6">
              <p className="text-sm text-muted-foreground">
                Aucun reçu pour le moment. Ils apparaîtront dès qu'un versement vous sera attribué.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 lg:px-6">
              <EmptyState
                icon={Search}
                title="Aucun reçu ne correspond"
                description="Ajustez votre recherche ou réinitialisez les filtres."
                actions={[{ label: "Réinitialiser", onClick: resetFilters, variant: "secondary" }]}
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {filtered.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/recus/${r.id}`}
                    aria-label={`Reçu ${r.receipt_number} — ${r.group_name}, tour ${r.turn_number}, ${formatGNF(r.amount)} GNF`}
                    className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-secondary/50 focus-visible:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary lg:px-6"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-50 text-accent-700">
                      <FileCheck2 className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{r.receipt_number}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.group_name} · Tour #{r.turn_number} · {providerLabel(r.provider)} ·{" "}
                        {new Date(r.issued_at).toLocaleDateString("fr-FR", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </p>
                    </div>
                    <p className="hidden font-display text-sm font-bold text-foreground num sm:block">
                      {formatGNF(r.amount)} <span className="text-xs text-muted-foreground">GNF</span>
                    </p>
                    <span aria-hidden="true" className="ml-2 inline-flex h-9 items-center rounded-md border border-hairline px-3 text-xs font-medium text-foreground">
                      Voir
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function ReceiptDetail({ id }: { id: string }) {
  const { data: receipt, isLoading } = useQuery({
    queryKey: ["receipts", id],
    queryFn: () => getReceiptById(id),
  });

  if (isLoading) {
    return <div className="px-6 py-12 text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!receipt) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">Reçu introuvable.</p>
        <Link to="/recus" className="mt-4 inline-block text-sm font-semibold text-primary underline">
          Retour aux reçus
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <TopBar title={`Reçu ${receipt.receipt_number}`} subtitle="Document numérique vérifiable" />
      <div className="mx-auto max-w-2xl space-y-4 px-5 py-6 lg:px-8 lg:py-8">
        <div className="flex justify-end print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-700"
          >
            <Printer className="h-4 w-4" />
            Imprimer / PDF
          </button>
        </div>

        <ReceiptCard receipt={receipt} />
      </div>
    </div>
  );
}

export function ReceiptCard({ receipt }: { receipt: DbReceipt }) {
  const dt = new Date(receipt.issued_at).toLocaleString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return (
    <article className="rounded-xl border border-hairline bg-card p-6 shadow-sm print:border-0 print:shadow-none">
      <header className="flex items-start justify-between border-b border-hairline pb-4">
        <div>
          <p className="font-display text-lg font-bold text-foreground">
            Tontine <span className="text-primary">Digital</span>
          </p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Reçu de versement
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">N° de reçu</p>
          <p className="font-display text-sm font-bold text-foreground num">{receipt.receipt_number}</p>
        </div>
      </header>

      <div className="my-5 rounded-lg bg-accent-50/60 p-5 text-center">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Montant versé</p>
        <p className="mt-1 font-display text-3xl font-bold text-foreground num">
          {formatGNF(receipt.amount)}
          <span className="ml-2 text-base font-medium text-muted-foreground">GNF</span>
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Field label="Bénéficiaire" value={receipt.beneficiary_name ?? "—"} />
        <Field label="Groupe" value={receipt.group_name} />
        <Field label="Tour" value={`#${receipt.turn_number}`} />
        <Field label="Moyen" value={providerLabel(receipt.provider)} />
        <Field label="Émis par" value={receipt.issued_by_name ?? "—"} />
        <Field label="Date d'émission" value={dt} />
      </dl>

      <footer className="mt-6 border-t border-hairline pt-4">
        <p className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Empreinte de vérification (SHA-256)
        </p>
        <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{receipt.hash}</p>
      </footer>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}

function providerLabel(p: string): string {
  switch (p) {
    case "orange_money": return "Orange Money";
    case "mtn_money": return "MTN Mobile Money";
    case "cash": return "Espèces";
    case "simulation": return "Simulation (sandbox)";
    default: return p;
  }
}