import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/layout/TopBar";
import { ComposeDialog } from "@/components/invite-members/ComposeDialog";
import { DistributionChannels } from "@/components/invite-members/DistributionChannels";
import { GroupSelector } from "@/components/invite-members/GroupSelector";
import { InviteKpiStrip } from "@/components/invite-members/InviteKpiStrip";
import { InvitationsTable } from "@/components/invite-members/InvitationsTable";
import { JoinRequestsCard } from "@/components/invite-members/JoinRequestsCard";
import {
  getInviteCodeForGroup,
  invitations as initialInvitations,
  joinRequests as initialJoinRequests,
  myOrganizedGroups,
} from "@/lib/mock-data";
import type { Invitation, JoinRequest } from "@/lib/types";

export default function InviteMembers() {
  const fallbackGroup = myOrganizedGroups[0];
  const [selectedId, setSelectedId] = useState(fallbackGroup?.id ?? "");

  const [allInvitations, setAllInvitations] = useState<Invitation[]>(initialInvitations);
  const [allRequests, setAllRequests] = useState<JoinRequest[]>(initialJoinRequests);

  const stats = useMemo(() => {
    const group = myOrganizedGroups.find((g) => g.id === selectedId);
    const inv = allInvitations.filter((i) => i.groupId === selectedId);
    const joined = inv.filter((i) => i.status === "joined").length;
    const opened = inv.filter(
      (i) => i.status === "opened" || i.status === "joined" || i.status === "declined",
    ).length;
    const sent = inv.length;
    const pending = allRequests.filter((r) => r.groupId === selectedId && r.status === "pending").length;
    const responded = inv.filter((i) => i.openedOn);
    const avgHours =
      responded.length > 0
        ? Math.max(1, Math.round(responded.reduce((s, i) => s + Math.abs(i.daysFromToday) * 4, 0) / responded.length))
        : 0;
    return {
      slots: group ? Math.max(0, group.members - joined) : 0,
      sent,
      joined,
      opened,
      conversion: sent > 0 ? Math.round((joined / sent) * 100) : 0,
      avgResponseHours: avgHours,
      pendingRequests: pending,
    };
  }, [selectedId, allInvitations, allRequests]);

  const inviteCode = useMemo(() => getInviteCodeForGroup(selectedId), [selectedId]);
  const selectedGroup = myOrganizedGroups.find((g) => g.id === selectedId);
  const groupInvitations = useMemo(
    () => allInvitations.filter((i) => i.groupId === selectedId),
    [allInvitations, selectedId],
  );
  const groupRequests = useMemo(
    () => allRequests.filter((r) => r.groupId === selectedId && r.status === "pending"),
    [allRequests, selectedId],
  );

  const [composeOpen, setComposeOpen] = useState(false);

  if (!fallbackGroup || !selectedGroup) {
    return (
      <div className="animate-fade-in">
        <TopBar title="Inviter des membres" subtitle="Distribuez vos émissions auprès des bons souscripteurs." />
        <div className="px-5 py-12 text-center text-sm text-muted-foreground lg:px-8">
          Vous n'organisez encore aucune tontine. Créez d'abord un groupe pour commencer à inviter.
        </div>
      </div>
    );
  }

  const handleResend = (id: string) => {
    setAllInvitations((prev) =>
      prev.map((inv) =>
        inv.id === id ? { ...inv, status: "sent", sentOn: "Aujourd'hui", daysFromToday: 0 } : inv,
      ),
    );
  };

  const handleCancel = (id: string) => {
    setAllInvitations((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, status: "expired" } : inv)),
    );
  };

  const handleRegenerate = () => {
    toast("Code régénéré", {
      description: "Les invitations en cours pointant sur l'ancien code restent valides 24h.",
    });
  };

  const handleApprove = (id: string) => {
    setAllRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));
  };

  const handleReject = (id: string) => {
    setAllRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));
  };

  const handleSent = (count: number) => {
    const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
    const fresh: Invitation[] = Array.from({ length: count }, (_, i) => ({
      id: `inv-new-${Date.now()}-${i}`,
      groupId: selectedId,
      groupName: selectedGroup.name,
      recipientName: `Diffusion ${now} #${i + 1}`,
      recipientInitials: "··",
      channel: "sms",
      sentOn: now,
      daysFromToday: 0,
      status: "sent",
    }));
    setAllInvitations((prev) => [...fresh, ...prev]);
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Inviter des membres"
        subtitle="Distribuez vos émissions auprès des souscripteurs ciblés et instruisez les candidatures spontanées."
        primaryAction={{
          label: "Composer",
          onClick: () => setComposeOpen(true),
          icon: <Send className="h-4 w-4" />,
        }}
      />

      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <InviteKpiStrip stats={stats} />

        <GroupSelector groups={myOrganizedGroups} selectedId={selectedId} onSelect={setSelectedId} />

        <DistributionChannels
          inviteCode={inviteCode}
          groupName={selectedGroup.name}
          onRegenerate={handleRegenerate}
          onOpenCompose={() => setComposeOpen(true)}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
          <InvitationsTable
            invitations={groupInvitations}
            onResend={handleResend}
            onCancel={handleCancel}
          />
          <JoinRequestsCard
            requests={groupRequests}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Tontine Digital horodate chaque émission, ouverture et adhésion. Le pipeline de souscription est
          chiffré bout-en-bout via les API Orange Money et MTN Mobile Money. Aucune notification n'est
          envoyée sans validation explicite de l'organisateur.
        </p>
      </div>

      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        groupName={selectedGroup.name}
        inviteCode={inviteCode}
        onSent={handleSent}
      />
    </div>
  );
}
