import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  Check,
  Search,
  Wallet,
  AlertTriangle,
  Inbox,
} from "lucide-react";
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
import { InFlightPaymentsCard } from "@/components/payment/InFlightPaymentsCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/hooks/useAuth";

type StatusFilter = "all" | "due" | "late" | "paid";

export default function MyContributions() {
  const { user } = useAuth();
  const { data: dues = [], isLoading } = useQuery({
    queryKey: ["contributions", "due"],
    queryFn: listMyContributionsDue,
  });
  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["payments", "history"],
    queryFn: listMyPaymentsHistory,
  });

  const [payingDue, setPayingDue] = useState<DbContributionDue | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  const groups = useMemo(() => {
    const map = new Map<string, string>();
    dues.forEach((d) => map.set(d.group_id, d.group_name));
    history.forEach((p) => map.set(p.group_id, p.group_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [dues, history]);

  const totalDue = useMemo(
    () => dues.reduce((s, d) => s + d.amount, 0),
    [dues],
  );
  const lateCount = useMemo(
    () => dues.filter((d) => d.days_to_due < 0).length,
    [dues],
  );

  const filteredDues = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dues.filter((d) => {
      if (groupFilter !== "all" && d.group_id !== groupFilter) return false;
      if (statusFilter === "paid") return false;
      if (statusFilter === "late" && d.days_to_due >= 0) return false;
      if (statusFilter === "due" && d.days_to_due < 0) return false;
      if (q && !d.group_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [dues, groupFilter, statusFilter, search]);

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter((p) => {
      if (statusFilter !== "all" && statusFilter !== "paid") return false;
      if (groupFilter !== "all" && p.group_id !== groupFilter) return false;
      if (q && !p.group_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [history, groupFilter, statusFilter, search]);

  const recap = useMemo(() => {
    const byGroup = new Map<string, { name: string; total: number; count: number; nextDue: string | null }>();
    for (const d of dues) {
      const cur = byGroup.get(d.group_id) ?? {
        name: d.group_name,
        total: 0,
        count: 0,
        nextDue: null,
      };
      cur.total += d.amount;
      cur.count += 1;
      if (!cur.nextDue || new Date(d.due_date) < new Date(cur.nextDue)) {
        cur.nextDue = d.due_date;
      }
      byGroup.set(d.group_id, cur);
    }
    return Array.from(byGroup.entries()).map(([id, v]) => ({ id, ...v }));
  }, [dues]);

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Mes contributions"
        subtitle="Suivez vos cotisations dues, en retard et payées."
      />
      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        {/* Hero compact billion-dollar */}
        <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary-700 p-6 text-primary-foreground shadow-[0_24px_60px_-30px_hsl(var(--primary)/0.6)]">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-accent/30 blur-3xl" />
          <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground/75">
                Total dû
              </p>
              <p className="mt-1 font-display text-3xl font-bold leading-tight num">
                {formatGNF(totalDue)} <span className="text-base font-medium text-primary-foreground/80">GNF</span>
              </p>
              <p className="mt-1 text-xs text-primary-foreground/75">
                {dues.length} cotisation{dues.length > 1 ? "s" : ""} à régler
              </p>
            </div>
            <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-3 backdrop-blur">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground/75">
                <AlertTriangle className="h-3.5 w-3.5" />
                En retard
              </div>
              <p className="mt-1 font-display text-2xl font-bold num">{lateCount}</p>
              <p className="text-[11px] text-primary-foreground/70">
                Cotisations dépassées
              </p>
            </div>
            <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-3 backdrop-blur">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground/75">
                <Check className="h-3.5 w-3.5" />
                Payées
              </div>
              <p className="mt-1 font-display text-2xl font-bold num">{history.length}</p>
              <p className="text-[11px] text-primary-foreground/70">
                Historique complet
              </p>
            </div>
          </div>
        </article>

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-card/80 p-2">
          <div className="relative flex h-10 min-w-[200px] flex-1 items-center">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une tontine…"
              className="h-full w-full rounded-lg border border-hairline bg-card pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-10 rounded-lg border border-hairline bg-card px-3 text-xs font-medium text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous statuts</option>
            <option value="due">À régler</option>
            <option value="late">En retard</option>
            <option value="paid">Payées</option>
          </select>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="h-10 rounded-lg border border-hairline bg-card px-3 text-xs font-medium text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            aria-label="Filtrer par tontine"
          >
            <option value="all">Toutes tontines</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <InFlightPaymentsCard userId={user?.id ?? null} />

        {/* Récap par tontine */}
        {recap.length > 0 && (statusFilter === "all" || statusFilter === "due" || statusFilter === "late") && (
          <SectionCard title="Récapitulatif par tontine" subtitle={`${recap.length} tontine${recap.length > 1 ? "s" : ""}`} bare>
            <ul className="divide-y divide-border/60">
              {recap.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-4 lg:px-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.count} échéance{r.count > 1 ? "s" : ""}
                      {r.nextDue
                        ? ` · prochaine ${new Date(r.nextDue).toLocaleDateString("fr-FR")}`
                        : ""}
                    </p>
                  </div>
                  <p className="font-display text-sm font-bold text-foreground num">
                    {formatGNF(r.total)} <span className="text-xs text-muted-foreground">GNF</span>
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        <SectionCard
          title="À régler"
          subtitle={isLoading ? "Chargement…" : `${filteredDues.length} résultat${filteredDues.length > 1 ? "s" : ""}`}
          bare
        >
          {isLoading ? (
            <ul className="divide-y divide-border/60">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="px-5 py-4 lg:px-6">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-secondary" />
                  <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-secondary/70" />
                </li>
              ))}
            </ul>
          ) : filteredDues.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Aucune cotisation à régler"
              description={
                statusFilter === "paid"
                  ? "Filtrez sur « Payées » pour voir l'historique."
                  : "Tout est à jour pour les filtres sélectionnés."
              }
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {filteredDues.map((d) => (
                <ContributionRow
                  key={d.contribution_id}
                  due={d}
                  onPay={() => setPayingDue(d)}
                />
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Historique"
          subtitle={loadingHistory ? "Chargement…" : `${filteredHistory.length} paiement${filteredHistory.length > 1 ? "s" : ""}`}
          bare
        >
          {loadingHistory ? (
            <ul className="divide-y divide-border/60">
              {Array.from({ length: 2 }).map((_, i) => (
                <li key={i} className="px-5 py-4 lg:px-6">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-secondary" />
                </li>
              ))}
            </ul>
          ) : filteredHistory.length === 0 ? (
            <EmptyState
              icon={Check}
              title="Aucun paiement"
              description="Vos paiements confirmés apparaîtront ici."
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {filteredHistory.slice(0, 50).map((p) => (
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
                    {formatGNF(p.amount)} <span className="text-xs text-muted-foreground">GNF</span>
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
