import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, UserPlus, Users, Calendar as CalendarIcon, Wallet, CheckCircle2 } from "lucide-react";
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
    <article className="rounded-xl border border-hairline bg-card p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary-50 text-primary">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-foreground num">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
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
        {/* Cotisations à payer — priorité absolue, zéro scroll */}
        <section aria-label="Cotisations à payer">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">
                À payer
              </h2>
              <p className="text-xs text-muted-foreground">
                {isLoadingDues
                  ? "Vérification de vos cotisations…"
                  : dues.length === 0
                  ? "Aucune cotisation en attente. Bravo, vous êtes à jour."
                  : `${dues.length} cotisation${dues.length > 1 ? "s" : ""} en attente`}
              </p>
            </div>
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

          {isLoadingDues ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl border border-hairline bg-card"
                />
              ))}
            </div>
          ) : dues.length === 0 ? (
            <div className="rounded-xl border border-hairline bg-card">
              <EmptyState
                icon={CheckCircle2}
                title="Vous êtes à jour 🎉"
                description="Aucune cotisation à régler pour l'instant. On vous préviendra dès qu'un nouveau tour démarre."
              />
            </div>
          ) : (
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
          )}
        </section>

        {/* KPI strip — vue d'ensemble */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiTile
            icon={Wallet}
            label="Total à payer"
            value={totalDue > 0 ? `${formatGNF(totalDue)} GNF` : "—"}
            hint={dues.length > 0 ? "Cumul des cotisations en attente" : "Vous êtes à jour"}
          />
          <KpiTile
            icon={CalendarIcon}
            label="Prochain tour"
            value={nextTurnLabel}
            hint={nextTurnHint}
          />
          <KpiTile
            icon={Users}
            label="Mes tontines"
            value={String(activeCount)}
            hint={`${groups.length} au total`}
          />
        </div>

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
