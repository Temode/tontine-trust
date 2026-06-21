import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Check,
  Search,
  Wallet,
  AlertTriangle,
  AlertCircle,
  Inbox,
  ArrowRight,
  ChevronRight,
  Clock,
  Receipt,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatGNF, formatRelativeDays } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  listMyContributionsDue,
  type DbContributionDue,
} from "@/lib/api/contributions";
import { listMyPaymentsHistory } from "@/lib/api/payments";
import { DjomyPaymentModal } from "@/components/payment/DjomyPaymentModal";
import { InFlightPaymentsCard } from "@/components/payment/InFlightPaymentsCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/hooks/useAuth";

type StatusFilter = "all" | "due" | "late" | "paid";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "due", label: "À régler" },
  { key: "late", label: "Retard" },
  { key: "paid", label: "Payées" },
];

export default function MyContributions() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [showAllDues, setShowAllDues] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, string>();
    dues.forEach((d) => map.set(d.group_id, d.group_name));
    history.forEach((p) => map.set(p.group_id, p.group_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [dues, history]);

  const sortedDues = useMemo(
    () => [...dues].sort((a, b) => a.days_to_due - b.days_to_due),
    [dues],
  );
  const totalDue = useMemo(
    () => dues.reduce((s, d) => s + d.amount, 0),
    [dues],
  );
  const lateCount = useMemo(
    () => dues.filter((d) => d.days_to_due < 0).length,
    [dues],
  );
  const mostUrgent = sortedDues[0] ?? null;
  const upcomingPreview = sortedDues.slice(0, 3);

  const filteredDues = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedDues.filter((d) => {
      if (groupFilter !== "all" && d.group_id !== groupFilter) return false;
      if (statusFilter === "paid") return false;
      if (statusFilter === "late" && d.days_to_due >= 0) return false;
      if (statusFilter === "due" && d.days_to_due < 0) return false;
      if (q && !d.group_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sortedDues, groupFilter, statusFilter, search]);

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

  const visibleDues = showAllDues ? filteredDues : filteredDues.slice(0, 6);
  const visibleHistory = filteredHistory.slice(0, 10);
  const lastPaymentAt = history[0]?.initiated_at ?? null;

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Payer"
        subtitle="Cockpit de paiement — vos cotisations en un coup d'œil."
      />
      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        {/* Cockpit hero asymétrique */}
        {isLoading ? (
          <HeroSkeleton />
        ) : (
          <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary-700 text-primary-foreground shadow-[0_30px_80px_-40px_hsl(var(--primary)/0.7)]">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary-foreground/30 to-transparent"
            />
            <div className="relative grid grid-cols-1 gap-8 p-6 lg:grid-cols-[1.4fr_1fr] lg:gap-10 lg:p-8">
              {/* Focus paiement */}
              <div className="flex min-w-0 flex-col">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary-foreground/70">
                  À régler maintenant
                </p>
                <p className="mt-2 font-display text-[40px] font-bold leading-[1.05] num lg:text-5xl">
                  {formatGNF(totalDue)}{" "}
                  <span className="text-lg font-medium text-primary-foreground/75 lg:text-xl">
                    GNF
                  </span>
                </p>
                <p className="mt-2 text-sm text-primary-foreground/80">
                  {dues.length} cotisation{dues.length > 1 ? "s" : ""}
                  {lateCount > 0 && (
                    <>
                      {" · "}
                      <span className="inline-flex items-center gap-1 font-semibold text-accent">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {lateCount} en retard
                      </span>
                    </>
                  )}
                </p>

                <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => mostUrgent && setPayingDue(mostUrgent)}
                    disabled={!mostUrgent}
                    className="inline-flex h-12 min-w-[180px] items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent px-5 text-sm font-semibold text-accent-foreground shadow-[0_10px_30px_-12px_hsl(var(--accent)/0.7)] transition hover:bg-accent/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {mostUrgent ? "Payer la plus urgente" : "Tout est à jour"}
                  </button>
                  {dues.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("due");
                        document
                          .getElementById("section-dues")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="inline-flex h-11 items-center gap-1 whitespace-nowrap rounded-md px-3 text-sm font-semibold text-primary-foreground/90 transition hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                    >
                      Tout voir
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Timeline prochaines échéances */}
              <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/[0.06] p-4 backdrop-blur">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary-foreground/70">
                    Prochaines échéances
                  </p>
                  <Clock className="h-3.5 w-3.5 text-primary-foreground/60" />
                </div>
                {upcomingPreview.length === 0 ? (
                  <p className="mt-4 text-sm text-primary-foreground/70">
                    Aucune échéance à venir.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-primary-foreground/10">
                    {upcomingPreview.map((d) => (
                      <li
                        key={d.contribution_id}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md bg-primary-foreground/10 text-[10px] uppercase leading-none">
                          <span className="text-[9px] text-primary-foreground/70">
                            {new Date(d.due_date).toLocaleDateString("fr-FR", { month: "short" })}
                          </span>
                          <span className="font-display text-sm font-bold leading-none">
                            {new Date(d.due_date).getDate()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{d.group_name}</p>
                          <p className="truncate text-[11px] text-primary-foreground/70">
                            Tour #{d.turn_number} · {formatRelativeDays(d.days_to_due)}
                          </p>
                        </div>
                        <p className="font-display text-sm font-bold num">
                          {formatGNF(d.amount)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </article>
        )}

        {/* Bande KPI */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiTile
            icon={<Wallet className="h-4 w-4" />}
            label="Total dû"
            value={`${formatGNF(totalDue)} GNF`}
            hint={`${dues.length} cotisation${dues.length > 1 ? "s" : ""}`}
          />
          <KpiTile
            icon={<AlertTriangle className="h-4 w-4" />}
            label="En retard"
            value={String(lateCount)}
            hint="Cotisations dépassées"
            tone={lateCount > 0 ? "destructive" : "default"}
          />
          <KpiTile
            icon={<Check className="h-4 w-4" />}
            label="Payées"
            value={String(history.length)}
            hint="Historique complet"
          />
        </div>

        <InFlightPaymentsCard userId={user?.id ?? null} />

        {/* Cotisations + filtres */}
        <section id="section-dues" className="space-y-4">
          <header className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
                Cotisations
              </h2>
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? "Chargement…"
                  : `${filteredDues.length} à régler · triées par urgence`}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <div role="group" aria-label="Filtrer par statut" className="inline-flex h-10 w-full items-center rounded-md border border-hairline bg-card p-0.5 sm:h-9 sm:w-auto">
                {STATUS_TABS.map((t) => {
                  const active = statusFilter === t.key;
                  return (
                    <button
                      key={t.key}
                      aria-pressed={active}
                      type="button"
                      onClick={() => setStatusFilter(t.key)}
                      className={cn(
                        "h-full flex-1 whitespace-nowrap rounded-[5px] px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 sm:flex-none",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div className="relative flex h-10 w-full items-center sm:h-9 sm:w-56">
                <label htmlFor="dues-search" className="sr-only">Rechercher une tontine</label>
                <Search aria-hidden="true" className="absolute left-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="dues-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher une tontine…"
                  className="h-full w-full rounded-md border border-hairline bg-card pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                />
              </div>
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="h-10 w-full rounded-md border border-hairline bg-card px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 sm:h-9 sm:w-auto sm:text-xs"
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
          </header>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <DueCardSkeleton key={i} />
              ))}
            </div>
          ) : statusFilter === "paid" ? (
            <EmptyState
              icon={Inbox}
              title="Filtre « Payées » actif"
              description="Les paiements confirmés apparaissent plus bas dans l'historique."
              actions={[{ label: "Voir tout", onClick: () => setStatusFilter("all"), variant: "secondary" }]}
            />
          ) : filteredDues.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Vous êtes à jour"
              description="Aucune cotisation en attente pour les filtres sélectionnés."
              actions={[
                { label: "Voir mes tontines", onClick: () => navigate("/groupes"), variant: "secondary" },
              ]}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleDues.map((d) => (
                  <DueContributionCard
                    key={d.contribution_id}
                    due={d}
                    onPay={() => setPayingDue(d)}
                  />
                ))}
              </div>
              {filteredDues.length > 6 && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowAllDues((v) => !v)}
                    className="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-md border border-hairline bg-card px-4 text-xs font-semibold text-foreground hover:bg-secondary"
                  >
                    {showAllDues ? "Réduire" : `Voir tout (${filteredDues.length})`}
                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showAllDues && "rotate-90")} />
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Vue par tontine — repli secondaire */}
        {recap.length > 0 && (
          <Accordion type="single" collapsible className="rounded-2xl border border-hairline bg-card">
            <AccordionItem value="recap" className="border-b-0">
              <AccordionTrigger className="px-5 py-4 hover:no-underline lg:px-6">
                <div className="flex flex-col items-start text-left">
                  <span className="font-display text-sm font-semibold text-foreground">
                    Vue par tontine
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {recap.length} tontine{recap.length > 1 ? "s" : ""} avec cotisations en cours
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                <ul className="divide-y divide-border/60 border-t border-hairline">
                  {recap.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 px-5 py-3.5 lg:px-6">
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Historique */}
        <SectionCard
          title="Historique des paiements"
          subtitle={
            loadingHistory
              ? "Chargement…"
              : lastPaymentAt
                ? `Dernier paiement le ${new Date(lastPaymentAt).toLocaleDateString("fr-FR")}`
                : "Aucun paiement encore enregistré"
          }
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
          ) : visibleHistory.length === 0 ? (
            <EmptyState
              icon={Check}
              title="Aucun paiement"
              description="Vos paiements confirmés apparaîtront ici."
            />
          ) : (
            <>
              <ul className="divide-y divide-border/60">
                {visibleHistory.map((p) => (
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
              {filteredHistory.length > visibleHistory.length && (
                <div className="border-t border-hairline px-5 py-3 lg:px-6">
                  <button
                    type="button"
                    onClick={() => navigate("/recus")}
                    className="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-md px-3 text-xs font-semibold text-primary hover:bg-primary/5"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    Voir tout l'historique
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </>
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
          turnNumber={payingDue.turn_number}
          dueDate={payingDue.due_date}
          beneficiaryName={payingDue.beneficiary_name}
        />
      )}
    </div>
  );
}

interface CardProps {
  due: DbContributionDue;
  onPay: () => void;
}

function DueContributionCard({ due, onPay }: CardProps) {
  const isOverdue = due.days_to_due < 0;
  const isUrgent = due.days_to_due >= 0 && due.days_to_due <= 3;
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition hover:border-primary/40 hover:shadow-[0_18px_40px_-24px_hsl(var(--primary)/0.35)]",
        "border-hairline",
        isOverdue && "border-l-4 border-l-destructive",
        isUrgent && "border-l-4 border-l-accent",
      )}
    >
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-2">
          {isOverdue ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
              <AlertCircle className="h-3 w-3" /> En retard
            </span>
          ) : isUrgent ? (
            <span className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
              Bientôt
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary">
              À régler
            </span>
          )}
          <p className="ml-auto truncate text-[11px] uppercase tracking-wider text-muted-foreground">
            Tour #{due.turn_number}
          </p>
        </div>

        <div>
          <p className="truncate text-sm font-semibold text-foreground">{due.group_name}</p>
          <p className="mt-1 font-display text-3xl font-bold text-foreground num">
            {formatGNF(due.amount)}{" "}
            <span className="text-base font-semibold text-muted-foreground">GNF</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {due.beneficiary_name ? `Pour ${due.beneficiary_name} · ` : ""}
            <span
              className={cn(
                "font-medium",
                isOverdue && "text-destructive",
                isUrgent && !isOverdue && "text-accent-foreground",
              )}
            >
              {formatRelativeDays(due.days_to_due)}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onPay}
          aria-label={`Payer ${formatGNF(due.amount)} GNF pour ${due.group_name}, tour ${due.turn_number}`}
          className="mt-auto inline-flex h-12 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-primary transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <ShieldCheck className="h-4 w-4" />
          Payer maintenant
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </article>
  );
}

function KpiTile({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "destructive";
}) {
  return (
    <div className="rounded-xl border border-hairline bg-card p-4">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md",
            tone === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary-50 text-primary",
          )}
        >
          {icon}
        </span>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-foreground num">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="h-[220px] animate-pulse rounded-2xl bg-gradient-to-br from-primary/40 to-primary/20" />
  );
}

function DueCardSkeleton() {
  return (
    <div className="rounded-xl border border-hairline bg-card p-5">
      <div className="h-4 w-20 animate-pulse rounded bg-secondary" />
      <div className="mt-4 h-8 w-2/3 animate-pulse rounded bg-secondary" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-secondary/70" />
      <div className="mt-5 h-11 w-full animate-pulse rounded-md bg-secondary" />
    </div>
  );
}
