import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  UserPlus,
  Users,
  Calendar as CalendarIcon,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { GroupRow } from "@/components/dashboard/GroupRow";
import { DueCard } from "@/components/dashboard/DueCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { listMyGroups } from "@/lib/api/groups";
import { overviewToTontine } from "@/lib/api/types";
import { listMyNextTurns } from "@/lib/api/turns";
import { listMyContributionsDue } from "@/lib/api/contributions";
import { formatGNF } from "@/lib/format";

function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="rounded-xl border border-hairline bg-card p-5 transition hover:border-primary/30">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-50 text-primary">
          <Icon className="h-[16px] w-[16px]" strokeWidth={1.75} />
        </div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className="mt-3 font-display text-2xl font-bold text-foreground num">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </article>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["groups", "mine"],
    queryFn: listMyGroups,
  });
  const { data: nextTurns = [] } = useQuery({
    queryKey: ["turns", "mine", "next"],
    queryFn: listMyNextTurns,
  });
  const { data: dues = [], isLoading: isLoadingDues } = useQuery({
    queryKey: ["contributions", "due"],
    queryFn: listMyContributionsDue,
  });

  const groups = useMemo(() => rows.map(overviewToTontine), [rows]);
  const activeCount = groups.filter((g) => g.status !== "completed").length;
  const preview = groups.slice(0, 5);

  const upcoming = nextTurns[0];
  const nextTurnLabel = upcoming
    ? new Date(upcoming.due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
    : "—";
  const nextTurnHint = upcoming
    ? `${upcoming.beneficiary_name ?? "Membre"} · tour #${upcoming.turn_number}`
    : "Aucun cycle actif";

  const totalDue = dues.reduce((s, d) => s + d.amount, 0);
  const sortedDues = useMemo(
    () => [...dues].sort((a, b) => a.days_to_due - b.days_to_due),
    [dues],
  );
  const topDues = sortedDues.slice(0, 3);
  const mostUrgent = sortedDues[0];
  const mostUrgentLabel = mostUrgent
    ? mostUrgent.days_to_due < 0
      ? `En retard de ${Math.abs(mostUrgent.days_to_due)} j`
      : mostUrgent.days_to_due === 0
        ? "À régler aujourd'hui"
        : `Prochaine échéance dans ${mostUrgent.days_to_due} j`
    : null;

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "";

  return (
    <div className="animate-fade-in">
      <TopBar
        title={firstName ? `Bonjour, ${firstName}` : "Tableau de bord"}
        subtitle="Voici ce qui demande votre attention aujourd'hui."
        primaryAction={{
          label: "Nouvelle tontine",
          onClick: () => navigate("/nouveau"),
          icon: <Plus className="h-4 w-4" />,
        }}
      />

      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        {/* HERO — panneau institutionnel : signal critique + CTA principal */}
        <section
          aria-label="Solde à régler"
          className="relative overflow-hidden rounded-2xl border border-hairline bg-card"
        >
          {/* fond sarcelle très discret */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-accent/[0.05]"
          />
          {/* filet sarcelle latéral, signature visuelle Tontine */}
          <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />

          <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-8">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {dues.length === 0 ? "Statut du compte" : "Solde à régler"}
              </p>

              {isLoadingDues ? (
                <div className="mt-3 h-10 w-56 animate-pulse rounded-md bg-secondary/60" />
              ) : dues.length === 0 ? (
                <div className="mt-2 flex items-center gap-2">
                  <ShieldCheck className="h-6 w-6 text-primary" strokeWidth={2} />
                  <p className="font-display text-3xl font-bold leading-none tracking-tight text-foreground">
                    Vous êtes à jour
                  </p>
                </div>
              ) : (
                <p className="mt-2 font-display text-[40px] font-bold leading-none tracking-tight text-foreground num lg:text-[44px]">
                  {formatGNF(totalDue)}
                  <span className="ml-2 align-baseline text-lg font-semibold text-muted-foreground">
                    GNF
                  </span>
                </p>
              )}

              <p className="mt-3 text-sm text-muted-foreground">
                {isLoadingDues
                  ? "Vérification de vos cotisations…"
                  : dues.length === 0
                    ? "Aucune cotisation en attente. On vous préviendra dès qu'un nouveau tour démarre."
                    : `${dues.length} cotisation${dues.length > 1 ? "s" : ""} en attente${mostUrgentLabel ? ` · ${mostUrgentLabel}` : ""}`}
              </p>
            </div>

            {dues.length > 0 && (
              <button
                type="button"
                onClick={() => navigate("/cotisations")}
                className="group inline-flex h-12 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-700 lg:self-auto"
              >
                Régler maintenant
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>

          {/* Bandeau métriques institutionnelles, intégré au hero */}
          <div className="relative grid grid-cols-2 divide-x divide-hairline border-t border-hairline bg-card/60 sm:grid-cols-3">
            <div className="px-6 py-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Prochain tour
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-foreground num">
                {nextTurnLabel}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{nextTurnHint}</p>
            </div>
            <div className="px-6 py-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Tontines actives
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-foreground num">
                {activeCount}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {groups.length} au total
              </p>
            </div>
            <div className="col-span-2 border-t border-hairline px-6 py-4 sm:col-span-1 sm:border-t-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Cotisations en attente
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-foreground num">
                {dues.length}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {dues.length === 0 ? "Aucune action requise" : "À traiter cette semaine"}
              </p>
            </div>
          </div>
        </section>

        {/* Liste des cotisations à payer (détail) */}
        {!isLoadingDues && dues.length > 0 && (
          <section aria-label="Détail des cotisations à payer">
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-foreground">
                Détail des échéances
              </h2>
              {dues.length > topDues.length && (
                <button
                  type="button"
                  onClick={() => navigate("/cotisations")}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Voir tout ({dues.length})
                </button>
              )}
            </div>
            <div className="space-y-3">
              {topDues.map((d) => (
                <DueCard
                  key={d.contribution_id}
                  contributionId={d.contribution_id}
                  groupName={d.group_name}
                  amount={d.amount}
                  daysToDue={d.days_to_due}
                  beneficiaryName={d.beneficiary_name}
                  turnNumber={d.turn_number}
                  expectedPenalty={d.expected_penalty}
                />
              ))}
            </div>
          </section>
        )}

        {isLoadingDues && (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-hairline bg-card"
              />
            ))}
          </div>
        )}

        {/* Mes tontines */}
        <SectionCard
          title="Mes tontines"
          subtitle={isLoading ? "Chargement…" : `${groups.length} groupe${groups.length > 1 ? "s" : ""}`}
          action={groups.length > 0 ? { label: "Voir tout", onClick: () => navigate("/groupes") } : undefined}
          bare
        >
          {isLoading ? (
            <div className="space-y-px p-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-secondary/40" />
              ))}
            </div>
          ) : preview.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Créez votre première tontine"
              description="Une tontine regroupe quelques proches qui cotisent à tour de rôle. Lancez la vôtre en 2 minutes, ou rejoignez celle d'un ami avec son code d'invitation."
              actions={[
                {
                  label: "Créer une tontine",
                  onClick: () => navigate("/nouveau"),
                  icon: <Plus className="h-4 w-4" />,
                  variant: "primary",
                },
                {
                  label: "Rejoindre avec un code",
                  onClick: () => navigate("/rejoindre"),
                  icon: <UserPlus className="h-4 w-4" />,
                  variant: "secondary",
                },
              ]}
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {preview.map((g) => (
                <li key={g.id}>
                  <GroupRow group={g} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
