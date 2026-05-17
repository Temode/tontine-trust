import { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/layout/TopBar";
import { ApiSection } from "@/components/settings/ApiSection";
import { ComplianceSection } from "@/components/settings/ComplianceSection";
import { LimitsSection } from "@/components/settings/LimitsSection";
import { MobileMoneySection } from "@/components/settings/MobileMoneySection";
import { PrivacySection } from "@/components/settings/PrivacySection";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SubscriptionSection } from "@/components/settings/SubscriptionSection";
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "@/components/settings/types";
import {
  apiKeys,
  billingInvoices,
  legalDocuments,
  mobileMoneyConnections,
  subscription,
  usageQuotas,
  webhookEndpoints,
} from "@/lib/mock-data";

export default function Settings() {
  const [current, setCurrent] = useState<SettingsSectionId>("subscription");

  const section = SETTINGS_SECTIONS.find((s) => s.id === current) ?? SETTINGS_SECTIONS[0];

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Paramètres"
        subtitle="Configuration du compte, des limites opérationnelles et des intégrations partenaires."
        primaryAction={{
          label: "Préférences personnelles",
          onClick: () =>
            toast("Préférences personnelles", {
              description: "Langue, thème et notifications sont gérés depuis Mon profil.",
            }),
          icon: <SettingsIcon className="h-4 w-4" />,
        }}
      />

      <div className="px-5 py-6 lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          <SettingsNav current={current} onChange={setCurrent} />

          <div className="space-y-4">
            <header className="rounded-xl border border-hairline bg-card px-5 py-4 lg:px-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Section
              </p>
              <h2 className="mt-1 font-display text-xl font-bold text-foreground lg:text-2xl">{section.label}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{section.description}</p>
            </header>

            {current === "subscription" && (
              <SubscriptionSection subscription={subscription} invoices={billingInvoices} />
            )}
            {current === "limits" && <LimitsSection quotas={usageQuotas} />}
            {current === "mobile-money" && <MobileMoneySection connections={mobileMoneyConnections} />}
            {current === "api" && <ApiSection apiKeys={apiKeys} webhooks={webhookEndpoints} />}
            {current === "privacy" && <PrivacySection />}
            {current === "compliance" && <ComplianceSection documents={legalDocuments} />}
          </div>
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground">
          Tontine Digital horodate chaque modification de paramètre. Les changements affectant la
          conformité (KYC, limites, agréments) sont notifiés en temps réel à la Banque Centrale de
          Guinée selon l'agrément BCG-2024-018.
        </p>
      </div>
    </div>
  );
}
