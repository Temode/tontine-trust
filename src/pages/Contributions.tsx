import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/layout/TopBar";
import { ContributionsKpiStrip } from "@/components/contributions/ContributionsKpiStrip";
import { ContributionsActivity } from "@/components/contributions/ContributionsActivity";
import { PaymentMethodsCard } from "@/components/contributions/PaymentMethodsCard";
import { UpcomingPayments } from "@/components/contributions/UpcomingPayments";
import { PaymentModal } from "@/components/payment/PaymentModal";
import {
  getContributionsStats,
  getUpcomingContributions,
  groups,
  paymentMethods as initialMethods,
  transactions,
} from "@/lib/mock-data";
import type { TontineGroup } from "@/lib/types";

export default function Contributions() {
  const stats = useMemo(() => getContributionsStats(), []);
  const upcoming = useMemo(() => getUpcomingContributions(), []);
  const [methods, setMethods] = useState(initialMethods);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentGroup, setPaymentGroup] = useState<TontineGroup | null>(null);

  const openPaymentFor = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setPaymentGroup(group);
    setPaymentOpen(true);
  };

  const handleSetPrimary = (id: string) => {
    setMethods((prev) => prev.map((m) => ({ ...m, primary: m.id === id })));
    const target = methods.find((m) => m.id === id);
    if (target) {
      toast.success("Méthode primaire mise à jour", {
        description: `${target.label} est maintenant utilisé par défaut.`,
      });
    }
  };

  const handleAddMethod = () => {
    toast("Ajout de méthode", {
      description: "Configuration via OM ou MTN — disponible dans le module à venir.",
    });
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Cotisations"
        subtitle="Échéancier opérationnel et historique consolidé de vos paiements."
        primaryAction={{
          label: "Payer une cotisation",
          onClick: () => {
            const next = upcoming.find((u) => u.payable);
            if (next) openPaymentFor(next.groupId);
            else openPaymentFor(groups[0].id);
          },
          icon: <Wallet className="h-4 w-4" />,
        }}
      />

      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <ContributionsKpiStrip stats={stats} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <UpcomingPayments items={upcoming} onPay={(item) => openPaymentFor(item.groupId)} />
          </div>
          <PaymentMethodsCard methods={methods} onAdd={handleAddMethod} onSetPrimary={handleSetPrimary} />
        </div>

        <ContributionsActivity transactions={transactions} />

        <p className="text-[11px] text-muted-foreground">
          Les opérations sont notarisées en temps réel via les API Orange Money et MTN Mobile Money.
          Aucun débit n'est exécuté sans confirmation explicite.
        </p>
      </div>

      {paymentGroup && (
        <PaymentModal
          group={paymentGroup}
          open={paymentOpen}
          onOpenChange={(open) => {
            setPaymentOpen(open);
            if (!open) setPaymentGroup(null);
          }}
        />
      )}
    </div>
  );
}
