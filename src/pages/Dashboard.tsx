import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { GroupRow } from "@/components/dashboard/GroupRow";
import { DeadlinesList } from "@/components/dashboard/DeadlinesList";
import { PrimaryBalanceCard, StatTile } from "@/components/dashboard/StatCards";
import { TransactionFilters, TransactionsTable, type Filter } from "@/components/dashboard/TransactionsTable";
import { ReliabilityCard } from "@/components/dashboard/ReliabilityCard";
import { DistributionCard } from "@/components/dashboard/DistributionCard";
import { MemberStatusGrid } from "@/components/dashboard/MemberStatusGrid";
import { PayCard, QuickLinks } from "@/components/dashboard/QuickActions";
import { PaymentModal } from "@/components/payment/PaymentModal";
import { RoleGuard } from "@/components/RoleGuard";
import {
  currentUser,
  getStats,
  groupDistribution,
  groups,
  liveMembersStatus,
  transactions,
  upcomingDeadlines,
} from "@/lib/mock-data";
import { formatGNF } from "@/lib/format";

export default function Dashboard() {
  const stats = getStats();
  const navigate = useNavigate();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const upcomingGroup = groups.find((g) => g.status === "your-turn") ?? groups[0];

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Tableau de bord"
        subtitle={`Bienvenue, ${currentUser.name.split(" ")[0]}. Voici un aperçu de vos tontines.`}
        primaryAction={{
          label: "Nouvelle cotisation",
          onClick: () => setPaymentOpen(true),
          icon: <Plus className="h-4 w-4" />,
        }}
      />

      <div className="px-5 py-6 lg:px-8 lg:py-8">
        {/* Row 1 — Headline KPIs */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          <PrimaryBalanceCard
            amount={stats.totalBalance}
            monthlyChange={stats.monthlyChange}
            monthlyTrend={stats.monthlyTrend}
          />
          <StatTile
            variant="out"
            label="Cotisations effectuées"
            primary={String(stats.contributionsCount)}
            secondary={`Total : ${formatGNF(stats.contributionsTotal, { withCurrency: true })}`}
            badge={`+${stats.contributionsCount > 0 ? 3 : 0} ce mois`}
          />
          <StatTile
            variant="in"
            label="Cagnottes reçues"
            primary={`${formatGNF(stats.cagnottesReceived)} GNF`}
            secondary="Prochain tour : 5 Jan"
            badge="2 tours"
          />
        </div>

        {/* Row 2 — Groups + Deadlines */}
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            title="Mes groupes de tontine"
            subtitle={`${stats.activeGroups} groupes actifs`}
            action={{ label: "Voir tout", onClick: () => navigate("/groupes") }}
            bare
          >
            <ul className="divide-y divide-border/60">
              {groups.map((g) => (
                <li key={g.id}>
                  <GroupRow group={g} />
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Prochaines échéances"
            action={{ label: "Calendrier", onClick: () => navigate("/calendrier") }}
          >
            <DeadlinesList deadlines={upcomingDeadlines} />
          </SectionCard>
        </div>

        {/* Row 3 — Transactions + Statistics */}
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            title="Transactions récentes"
            subtitle="Cotisations et versements"
            rightSlot={<TransactionFilters value={filter} onChange={setFilter} />}
            bare
          >
            <TransactionsTable transactions={transactions} filter={filter} />
            <div className="border-t border-hairline px-5 py-3 text-center lg:px-6">
              <button
                type="button"
                onClick={() => navigate("/historique")}
                className="text-sm font-medium text-primary transition hover:text-primary-700"
              >
                Voir toutes les transactions →
              </button>
            </div>
          </SectionCard>

          <div className="space-y-5">
            <ReliabilityCard
              score={stats.reliabilityScore}
              onTime={stats.onTimePayments}
              late={stats.lateCount}
              memberSince={currentUser.memberSince}
            />
            <DistributionCard items={groupDistribution} />
          </div>
        </div>

        {/* Row 4 — Live members status + actions */}
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <RoleGuard
            allowedRoles={["admin", "organisateur"]}
            fallback={
              <SectionCard
                className="lg:col-span-2"
                title="État des cotisations"
                subtitle="Réservé aux organisateurs"
              >
                <p className="text-sm text-muted-foreground">
                  Cette vue détaillée des cotisations est réservée aux administrateurs et organisateurs du groupe.
                </p>
              </SectionCard>
            }
          >
          <SectionCard
            className="lg:col-span-2"
            title="État des cotisations"
            rightSlot={
              <span className="hidden items-center gap-1.5 rounded-full bg-success/10 px-2 py-1 text-[11px] font-medium text-success sm:inline-flex">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-success" />
                En temps réel
              </span>
            }
            action={{ label: "Détails", onClick: () => navigate(`/groupes/${upcomingGroup.id}`) }}
          >
            <div className="mb-5 flex flex-col gap-3 rounded-lg border border-hairline bg-secondary/40 p-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex-1">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Cotisations reçues ce tour</span>
                  <span className="font-medium text-foreground num">16/20 membres</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-card">
                  <div className="h-full rounded-full bg-success" style={{ width: "80%" }} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Collecté</p>
                <p className="font-display text-lg font-bold text-foreground num">
                  {formatGNF(16_000_000, { withCurrency: true })}
                </p>
              </div>
            </div>
            <MemberStatusGrid entries={liveMembersStatus} />
          </SectionCard>
          </RoleGuard>

          <div className="space-y-5">
            <PayCard onPay={() => setPaymentOpen(true)} />
            <QuickLinks />
          </div>
        </div>
      </div>

      <PaymentModal group={upcomingGroup} open={paymentOpen} onOpenChange={setPaymentOpen} />
    </div>
  );
}
