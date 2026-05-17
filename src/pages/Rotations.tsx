import { useMemo } from "react";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/layout/TopBar";
import { CompletedTurnsTable } from "@/components/rotations/CompletedTurnsTable";
import { NextTurnHero } from "@/components/rotations/NextTurnHero";
import { RotationAgenda } from "@/components/rotations/RotationAgenda";
import { RotationsKpiStrip } from "@/components/rotations/RotationsKpiStrip";
import { RotationTimeline } from "@/components/rotations/RotationTimeline";
import { SwapProposalsCard } from "@/components/rotations/SwapProposalsCard";
import {
  getAllTurns,
  getRotationStats,
  getYourNextTurn,
  swapProposals,
} from "@/lib/mock-data";

export default function Rotations() {
  const turns = useMemo(() => getAllTurns(), []);
  const stats = useMemo(() => getRotationStats(), []);
  const nextTurn = useMemo(() => getYourNextTurn(), []);

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Rotations & Tours"
        subtitle="Calendrier consolidé des bénéficiaires de votre portefeuille de tontines."
        primaryAction={{
          label: "Proposer un échange",
          onClick: () =>
            toast("Module à venir", {
              description: "L'assistant d'échange de tours sera disponible dans la prochaine livraison.",
            }),
          icon: <ArrowRightLeft className="h-4 w-4" />,
        }}
      />

      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <RotationsKpiStrip stats={stats} />

        <NextTurnHero turn={nextTurn} />

        <RotationTimeline turns={turns} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <RotationAgenda turns={turns} />
          </div>
          <SwapProposalsCard proposals={swapProposals} />
        </div>

        <CompletedTurnsTable turns={turns} />

        <p className="text-[11px] text-muted-foreground">
          Le versement de chaque cagnotte est exécuté automatiquement dès réception de l'intégralité
          des cotisations du tour. Les ordres de rotation et les échanges sont notarisés sur le registre
          immuable du groupe.
        </p>
      </div>
    </div>
  );
}
