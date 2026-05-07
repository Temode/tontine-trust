import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/layout/AppHeader";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { GroupCard } from "@/components/dashboard/GroupCard";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { TransactionItem } from "@/components/dashboard/TransactionItem";
import { PaymentModal } from "@/components/payment/PaymentModal";
import { getStats, groups, transactions } from "@/lib/mock-data";

export default function Dashboard() {
  const stats = getStats();
  const navigate = useNavigate();
  const [paymentOpen, setPaymentOpen] = useState(false);
  // For the dashboard's "Cotiser" action, default to the next group needing payment.
  const upcomingGroup = groups.find((g) => g.status === "active") ?? groups[0];

  return (
    <div className="animate-fade-in">
      <AppHeader />

      <div className="mx-auto max-w-5xl px-5 md:px-8">
        {/* Balance card overlapping the header */}
        <div className="-mt-14 md:-mt-16">
          <BalanceCard
            amount={stats.totalBalance}
            onPay={() => setPaymentOpen(true)}
            onHistory={() => navigate("/historique")}
          />
        </div>

        <div className="mt-5 md:mt-8">
          <QuickStats
            activeGroups={stats.activeGroups}
            contributions={stats.totalContributions}
            reliabilityScore={stats.reliabilityScore}
          />
        </div>

        <section className="mt-6 md:mt-10">
          <SectionHeader title="Mes Tontines" action={{ label: "Voir tout", onClick: () => navigate("/groupes") }} />
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4">
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        </section>

        <section className="mt-6 md:mt-10">
          <SectionHeader title="Transactions récentes" action={{ label: "Voir tout", onClick: () => navigate("/historique") }} />
          <div className="overflow-hidden rounded-2xl bg-card shadow-soft">
            {transactions.slice(0, 4).map((tx, i, arr) => (
              <TransactionItem key={tx.id} tx={tx} withDivider={i !== arr.length - 1} />
            ))}
          </div>
        </section>
      </div>

      <PaymentModal group={upcomingGroup} open={paymentOpen} onOpenChange={setPaymentOpen} />
    </div>
  );
}
