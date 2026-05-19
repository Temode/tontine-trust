import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/layout/TopBar";
import { ApplicationsList } from "@/components/join-group/ApplicationsList";
import { CodeEntryHero } from "@/components/join-group/CodeEntryHero";
import { Directory } from "@/components/join-group/Directory";
import { JoinKpiStrip } from "@/components/join-group/JoinKpiStrip";
import { SubscriptionDialog } from "@/components/join-group/SubscriptionDialog";
import {
  directoryGroups,
  getJoinStats,
  myApplications as initialApplications,
} from "@/lib/mock-data";
import type { DirectoryGroup, JoinApplication } from "@/lib/types";

export default function JoinGroup() {
  const stats = useMemo(() => getJoinStats(), []);

  const [subscriptionTarget, setSubscriptionTarget] = useState<DirectoryGroup | null>(null);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [applications, setApplications] = useState<JoinApplication[]>(initialApplications);

  const handleSubscribe = (group: DirectoryGroup) => {
    setSubscriptionTarget(group);
    setSubscriptionOpen(true);
  };

  const handleCancel = (id: string) => {
    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status: "cancelled" } : app)),
    );
    toast("Candidature retirée", {
      description: "L'organisateur a été notifié.",
    });
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Rejoindre un groupe"
        subtitle="Saisissez un code d'invitation ou explorez l'annuaire des émissions ouvertes."
        primaryAction={{
          label: "Créer un groupe",
          onClick: () => {
            window.location.href = "/nouveau";
          },
          icon: <Plus className="h-4 w-4" />,
        }}
      />

      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <JoinKpiStrip stats={stats} />

        <CodeEntryHero />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
          <Directory groups={directoryGroups} onSelect={handleSubscribe} />
          <ApplicationsList applications={applications} onCancel={handleCancel} />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Tontine Digital horodate chaque candidature sur un registre immuable. Aucune adhésion n'est
          effective avant la validation explicite de l'organisateur du groupe et la confirmation
          biométrique de votre côté.
        </p>
      </div>

      <SubscriptionDialog
        group={subscriptionTarget}
        open={subscriptionOpen}
        onOpenChange={(open) => {
          setSubscriptionOpen(open);
          if (!open) setSubscriptionTarget(null);
        }}
      />
    </div>
  );
}
