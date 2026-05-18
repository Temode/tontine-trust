import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopBar } from "@/components/layout/TopBar";
import { DangerZone } from "@/components/profile/DangerZone";
import { IdentityCard } from "@/components/profile/IdentityCard";
import { KycPanel } from "@/components/profile/KycPanel";
import { MandatesPanel } from "@/components/profile/MandatesPanel";
import { PreferencesPanel } from "@/components/profile/PreferencesPanel";
import { ProfileActivity } from "@/components/profile/ProfileActivity";
import { ProfileUpdateForm } from "@/components/profile/ProfileUpdateForm";
import { ReliabilityBreakdown } from "@/components/profile/ReliabilityBreakdown";
import { SecurityPanel } from "@/components/profile/SecurityPanel";
import { TrackRecordStrip } from "@/components/profile/TrackRecordStrip";
import {
  getReliabilityBreakdown,
  groups,
  kycDocuments,
  profileActivity,
  sessionDevices,
  userProfile,
} from "@/lib/mock-data";

export default function Profile() {
  const factors = getReliabilityBreakdown();
  const organized = groups.filter((g) => g.role === "organizer").length;
  const participated = groups.filter((g) => g.role === "participant").length;

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Mon profil"
        subtitle="Identité, conformité, sécurité et préférences sur l'infrastructure Tontine Digital."
        primaryAction={{
          label: "Modifier le profil",
          onClick: () =>
            toast("Édition rapide", {
              description: "Utilisez l'onglet Identité & KYC pour des modifications complètes.",
            }),
          icon: <Pencil className="h-4 w-4" />,
        }}
      />

      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <IdentityCard
          profile={userProfile}
          organizedCount={organized}
          participantCount={participated}
          onEdit={() =>
            toast("Édition rapide", {
              description: "L'édition complète est dans l'onglet Identité & KYC.",
            })
          }
        />

        <TrackRecordStrip profile={userProfile} />

        <Tabs defaultValue="overview" className="space-y-6">
          <div className="-mx-5 overflow-x-auto px-5 lg:-mx-8 lg:px-8">
            <TabsList className="inline-flex h-auto min-w-full justify-start gap-1 rounded-xl border border-hairline bg-card p-1 lg:min-w-0">
              <TabsTrigger
                value="overview"
                className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-soft"
              >
                Vue d'ensemble
              </TabsTrigger>
              <TabsTrigger
                value="identity"
                className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-soft"
              >
                Identité & KYC
              </TabsTrigger>
              <TabsTrigger
                value="security"
                className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-soft"
              >
                Sécurité
              </TabsTrigger>
              <TabsTrigger
                value="preferences"
                className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-soft"
              >
                Préférences
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-soft"
              >
                Activité
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <ReliabilityBreakdown score={userProfile.reliabilityScore} factors={factors} />
            <MandatesPanel groups={groups} />
          </TabsContent>

          <TabsContent value="identity" className="space-y-6">
            <ProfileUpdateForm />
            <KycPanel profile={userProfile} documents={kycDocuments} />
          </TabsContent>

          <TabsContent value="security">
            <SecurityPanel profile={userProfile} devices={sessionDevices} />
          </TabsContent>

          <TabsContent value="preferences">
            <PreferencesPanel profile={userProfile} />
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <ProfileActivity events={profileActivity} />
            <DangerZone />
          </TabsContent>
        </Tabs>

        <p className="text-[11px] text-muted-foreground">
          Tontine Digital horodate chaque mise à jour de profil et chaque événement de sécurité sur un
          registre immuable. Les documents KYC sont chiffrés AES-256 et accessibles uniquement par le
          service conformité.
        </p>
      </div>
    </div>
  );
}
