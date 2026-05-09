import { useMemo } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/layout/TopBar";
import { ActivityJournal } from "@/components/history/ActivityJournal";
import { CashflowChart } from "@/components/history/CashflowChart";
import { HistoryKpiStrip } from "@/components/history/HistoryKpiStrip";
import { LedgerTable } from "@/components/history/LedgerTable";
import { StatementsCard } from "@/components/history/StatementsCard";
import {
  getCashflowSeries,
  getHistoryStats,
  getStatements,
  groups,
  ledgerEvents,
  transactions,
} from "@/lib/mock-data";

export default function History() {
  const stats = useMemo(() => getHistoryStats(), []);
  const series = useMemo(() => getCashflowSeries(), []);
  const statements = useMemo(() => getStatements(), []);

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Historique"
        subtitle="Registre consolidé et immuable de toutes les opérations sur votre portefeuille."
        primaryAction={{
          label: "Exporter le relevé",
          onClick: () =>
            toast("Export du relevé annuel", {
              description:
                "Le pack d'archivage (CSV + PDF + signatures) sera téléchargé dans la prochaine livraison.",
            }),
          icon: <Download className="h-4 w-4" />,
        }}
      />

      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <HistoryKpiStrip stats={stats} />

        <CashflowChart data={series} />

        <LedgerTable transactions={transactions} groups={groups} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <ActivityJournal events={ledgerEvents} />
          </div>
          <StatementsCard statements={statements} />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Tontine Digital conserve un registre immuable de toutes les opérations. Chaque ligne porte une
          signature cryptographique vérifiable. Les relevés mensuels sont certifiés conformes pour usage
          fiscal et bancaire.
        </p>
      </div>
    </div>
  );
}
