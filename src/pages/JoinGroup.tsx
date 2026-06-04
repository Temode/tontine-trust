import { Plus } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { CodeEntryHero } from "@/components/join-group/CodeEntryHero";

export default function JoinGroup() {
  return (
    <div className="animate-fade-in">
      <TopBar
        title="Rejoindre un groupe"
        subtitle="Saisissez le code d'invitation transmis par l'organisateur."
        primaryAction={{
          label: "Créer un groupe",
          onClick: () => {
            window.location.href = "/nouveau";
          },
          icon: <Plus className="h-4 w-4" />,
        }}
      />

      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <CodeEntryHero />

        <p className="text-[11px] text-muted-foreground">
          Tontine Digital horodate chaque candidature sur un registre immuable. Aucune adhésion n'est
          effective avant la validation explicite de l'organisateur du groupe et la confirmation
          biométrique de votre côté.
        </p>
      </div>
    </div>
  );
}
