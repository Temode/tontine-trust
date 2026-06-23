import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bell,
  Calendar,
  CheckCircle2,
  HandCoins,
  FileCheck2,
  MoreVertical,
  Play,
  Star,
  UserPlus,
  ShieldCheck,
  Users,
  ChevronRight,
  Wallet,
  X,
  Lock,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatGNF, getInitials } from "@/lib/format";
import { getGroup } from "@/lib/api/groups";
import {
  approveMember,
  listGroupMembers,
  rejectMember,
  startCycle,
} from "@/lib/api/members";
import { listGroupTurns } from "@/lib/api/turns";
import { releasePayout, listGroupLedger } from "@/lib/api/payouts";
import { listMyContributionsDue } from "@/lib/api/contributions";
import { launchDjomyCheckout } from "@/lib/payment/launchDjomyCheckout";
import { getGroupReliability, type DbGroupReliabilityRow } from "@/lib/api/reliability";
import { ReliabilityBadge } from "@/components/reliability/ReliabilityBadge";
import { useAuth } from "@/hooks/useAuth";
import type { DbGroup, DbGroupMember, DbNextTurn } from "@/lib/api/types";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { InvitePanel, INVITE_PANEL_ID } from "@/components/groups/InvitePanel";
import { GroupChat } from "@/components/group/GroupChat";
import { AnnouncementsPanel } from "@/components/group/AnnouncementsPanel";
import { AuditLog } from "@/components/group/AuditLog";
import { SwapsPanel } from "@/components/group/SwapsPanel";
import { AuctionPanel } from "@/components/group/AuctionPanel";
import { ReviewsPanel } from "@/components/group/ReviewsPanel";
import { InvitationsHistoryPanel } from "@/components/groups/InvitationsHistoryPanel";
import { GroupDefaultersSection } from "@/components/group/GroupDefaultersSection";
import { GroupDisputesSection } from "@/components/group/GroupDisputesSection";
import {
  decidePaymentPauseRequest,
  listGroupPauseRequests,
  requestPaymentDuringPause,
  type PausePaymentRequest,
} from "@/lib/api/pauseRequests";
import { supabase } from "@/integrations/supabase/client";
import { CurrentTurnBanner } from "@/components/group/CurrentTurnBanner";
import { useTontineRealtime } from "@/hooks/useTontineRealtime";
import { DepositCallout } from "@/components/group/DepositCallout";
import { PositionBadge } from "@/components/group/PositionBadge";
import { ContractSignDialog } from "@/components/contract/ContractSignDialog";
import { getActiveContract, getMyContractSignature } from "@/lib/api/contracts";
import { useQuery as useQueryContract } from "@tanstack/react-query";

function ContractSignSection({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  const contractQ = useQueryContract({
    queryKey: ["active-contract", groupId],
    queryFn: () => getActiveContract(groupId),
    enabled: !!groupId,
  });
  const sigQ = useQueryContract({
    queryKey: ["my-contract-sig", contractQ.data?.contract_id],
    queryFn: () => getMyContractSignature(contractQ.data!.contract_id),
    enabled: !!contractQ.data?.contract_id,
  });
  if (!contractQ.data) return null;
  if (sigQ.data) return null;
  return (
    <>
      <section className="mt-5 rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
          Signature requise
        </p>
        <h3 className="mt-0.5 font-display text-base font-bold text-amber-950">
          Signez le contrat numérique pour activer le cycle
        </h3>
        <p className="mt-1.5 text-sm text-amber-900/90">
          Le démarrage du cycle est bloqué tant que tous les membres n'ont pas signé.
          Signature électronique via code SMS — 1 minute.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700"
        >
          Signer le contrat
        </button>
      </section>
      <ContractSignDialog open={open} onOpenChange={setOpen} groupId={groupId} />
    </>
  );
}

type Section =
  | "overview"
  | "members"
  | "rotation"
  | "invitations"
  | "swaps"
  | "auctions"
  | "reviews"
  | "chat"
  | "audit";

const FREQ_LABEL: Record<string, string> = {
  mensuelle: "Mensuelle",
  hebdomadaire: "Hebdomadaire",
  quinzaine: "Quinzaine",
};

function statusLabel(s: DbGroup["status"]): string {
  switch (s) {
    case "draft": return "Brouillon";
    case "open": return "Ouvert";
    case "active": return "Actif";
    case "paused": return "En pause";
    case "completed": return "Terminé";
    case "cancelled": return "Annulé";
  }
}

function statusTurnLabel(s: string): string {
  switch (s) {
    case "upcoming": return "À venir";
    case "collecting": return "Collecte en cours";
    case "paid": return "Versé";
    case "skipped": return "Sauté";
    default: return s;
  }
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("overview");

  useTontineRealtime(id);

  const groupQ = useQuery({
    queryKey: ["group", id],
    queryFn: () => getGroup(id as string),
    enabled: !!id,
  });
  const membersQ = useQuery({
    queryKey: ["group", id, "members"],
    queryFn: () => listGroupMembers(id as string),
    enabled: !!id,
  });
  const adminPermsQ = useQuery({
    queryKey: ["group-admin-perms", id],
    queryFn: () => import("@/lib/api/adminPermissions").then((m) => m.listAdminPermissions(id as string)),
    enabled: !!id,
  });
  const turnsQ = useQuery({
    queryKey: ["group", id, "turns"],
    queryFn: () => listGroupTurns(id as string),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["group", id] });
    queryClient.invalidateQueries({ queryKey: ["my-groups"] });
  };

  const approveM = useMutation({
    mutationFn: (memberId: string) => approveMember(memberId),
    onSuccess: () => { toast.success("Candidature acceptée"); invalidate(); },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });
  const rejectM = useMutation({
    mutationFn: (memberId: string) => rejectMember(memberId),
    onSuccess: () => { toast.success("Candidature refusée"); invalidate(); },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });
  const startCycleM = useMutation({
    mutationFn: () => startCycle(id as string),
    onSuccess: () => {
      toast.success("Cycle démarré", { description: "L'ordre de rotation a été tiré." });
      invalidate();
    },
    onError: (e: unknown) => {
      const err = e as { message?: string; details?: string; hint?: string; code?: string };
      const desc = [err?.message, err?.details, err?.hint, err?.code].filter(Boolean).join(" — ");
      toast.error("Démarrage impossible", { description: desc || "Erreur inconnue" });
    },
  });

  const payoutM = useMutation({
    mutationFn: (turnId: string) => releasePayout(turnId),
    onSuccess: () => {
      toast.success("Versement effectué", { description: "Le reçu numérique a été généré." });
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["group", id, "ledger"] });
    },
    onError: (e: Error) => toast.error("Versement impossible", { description: e.message }),
  });

  const ledgerQ = useQuery({
    queryKey: ["group", id, "ledger"],
    queryFn: () => listGroupLedger(id as string, 5),
    enabled: !!id,
  });

  const reliabilityQ = useQuery({
    queryKey: ["group", id, "reliability"],
    queryFn: () => getGroupReliability(id as string),
    enabled: !!id,
  });

  const duesQ = useQuery({
    queryKey: ["contributions", "due"],
    queryFn: listMyContributionsDue,
  });

  // ---------- Pause: organizer profile + authorization requests + realtime ----------
  const organizerProfileQ = useQuery({
    queryKey: ["group", id, "organizer-profile", groupQ.data?.created_by],
    enabled: !!groupQ.data?.created_by,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", groupQ.data!.created_by)
        .maybeSingle();
      return (data?.full_name as string | null) ?? null;
    },
  });

  const pauseRequestsQ = useQuery({
    queryKey: ["group", id, "pause-requests"],
    queryFn: () => listGroupPauseRequests(id as string),
    enabled: !!id && groupQ.data?.status === "paused",
  });

  const requestPaymentM = useMutation({
    mutationFn: (contributionId: string) => requestPaymentDuringPause(contributionId),
    onSuccess: () => {
      toast.success("Demande envoyée", { description: "L'organisateur a été notifié." });
      queryClient.invalidateQueries({ queryKey: ["group", id, "pause-requests"] });
    },
    onError: (e: Error) => toast.error("Demande impossible", { description: e.message }),
  });

  const decideRequestM = useMutation({
    mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) =>
      decidePaymentPauseRequest(requestId, approve),
    onSuccess: (_data, vars) => {
      toast.success(vars.approve ? "Autorisation accordée" : "Demande refusée");
      queryClient.invalidateQueries({ queryKey: ["group", id, "pause-requests"] });
    },
    onError: (e: Error) => toast.error("Action impossible", { description: e.message }),
  });

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`group-${id}-pause`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "groups", filter: `id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["group", id] });
          queryClient.invalidateQueries({ queryKey: ["contributions", "due"] });
          queryClient.invalidateQueries({ queryKey: ["group", id, "pause-requests"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_pause_requests", filter: `group_id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["group", id, "pause-requests"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  if (groupQ.isLoading) {
    return <div className="px-6 py-12 text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!groupQ.data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="font-display text-lg font-bold text-foreground">Groupe introuvable</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ce groupe n'existe pas ou a été supprimé.</p>
        <Link to="/groupes" className="mt-6 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          Retour à mes groupes
        </Link>
      </div>
    );
  }

  const grp = groupQ.data;
  const allMembers = membersQ.data ?? [];
  const activeMembers = allMembers.filter((m) => m.status === "active");
  const pendingMembers = allMembers.filter((m) => m.status === "pending");
  const turns = turnsQ.data ?? [];
  const isOrganizer =
    (!!user?.id && grp.created_by === user.id) ||
    activeMembers.some((m) => m.user_id === user?.id && m.role === "organisateur");
  const isCoOrgAdmin = !!user?.id && (adminPermsQ.data ?? []).some((r) => r.user_id === user.id);
  const canManageMembers = isOrganizer || isCoOrgAdmin;
  const frequency = FREQ_LABEL[grp.frequency] ?? "Mensuelle";
  const totalPayout = grp.contribution_amount * activeMembers.length;

  const myDueForGroup = (duesQ.data ?? [])
    .filter((d) => d.group_id === grp.id && d.status !== "submitted")
    .sort((a, b) => a.turn_number - b.turn_number)[0];
  const canStart =
    isOrganizer && (grp.status === "draft" || grp.status === "open") && activeMembers.length >= 2;
  const nextTurn =
    turns.find((t) => t.status === "collecting") ?? turns.find((t) => t.status === "upcoming") ?? null;
  const completedTurns = turns.filter((t) => t.status === "paid").length;
  const isPaused = grp.status === "paused";
  const isArchived = !!grp.archived_at || grp.status === "completed" || grp.status === "cancelled";
  const paymentsBlocked = isPaused || isArchived;
  const progress = turns.length > 0 ? Math.round((completedTurns / turns.length) * 100) : 0;

  const tabs: Array<{ id: Section; label: string }> = [
    { id: "overview", label: "Aperçu" },
    { id: "members", label: "Membres" },
    { id: "rotation", label: "Rotation" },
    ...(isOrganizer ? [{ id: "invitations" as Section, label: "Invitations" }] : []),
    { id: "swaps", label: "Échanges" },
    ...(grp.rotation_order_kind === "auction" ? [{ id: "auctions" as Section, label: "Enchères" }] : []),
    ...(grp.status === "completed" ? [{ id: "reviews" as Section, label: "Avis" }] : []),
    { id: "chat", label: "Discussion" },
    ...(isOrganizer ? [{ id: "audit" as Section, label: "Audit" }] : []),
  ];

  return (
    <div className="animate-fade-in">
      <header className="sticky top-0 z-30 border-b border-hairline bg-card/85 backdrop-blur">
        <div className="flex items-center gap-3 px-5 py-4 lg:px-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-hairline text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Groupe de tontine</p>
            <h1 className="truncate font-display text-xl font-bold text-foreground lg:text-2xl">{grp.name}</h1>
          </div>
          {isOrganizer && (
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById(INVITE_PANEL_ID);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="hidden h-10 items-center gap-1.5 rounded-lg border border-hairline px-3 text-xs font-medium text-foreground transition hover:bg-secondary sm:inline-flex"
            >
              <UserPlus className="h-4 w-4" />
              Inviter
            </button>
          )}
          {isOrganizer && (
            <Link
              to={`/groupes/${grp.id}/co-organisateurs`}
              className="hidden h-10 items-center gap-1.5 rounded-lg border border-hairline px-3 text-xs font-medium text-foreground transition hover:bg-secondary sm:inline-flex"
            >
              <ShieldCheck className="h-4 w-4" />
              Co-org.
            </Link>
          )}
          <button
            type="button"
            aria-label="Plus d'options"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-hairline text-muted-foreground transition hover:text-foreground"
          >
            <MoreVertical className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      <div className="px-5 py-6 lg:px-8 lg:py-8">
        {/* Hero billion-dollar : dégradé sarcelle profond + halo doré */}
        <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary-700 p-6 text-primary-foreground shadow-[0_24px_60px_-30px_hsl(var(--primary)/0.7)] lg:p-8">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
            <div className="absolute -left-20 bottom-0 h-48 w-48 rounded-full bg-primary-foreground/10 blur-3xl" />
          </div>
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2.5 py-1 font-medium uppercase tracking-[0.12em] text-primary-foreground/90 backdrop-blur">
                {statusLabel(grp.status)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/25 px-2.5 py-1 font-medium uppercase tracking-[0.12em] text-accent-foreground">
                {frequency}
              </span>
              {grp.category && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-2.5 py-1 font-medium text-primary-foreground/85">
                  {grp.category}
                </span>
              )}
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight lg:text-4xl">
              {grp.name}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-primary-foreground/85">
              Cagnotte par tour ·{" "}
              <span className="font-display text-base font-semibold text-primary-foreground num">
                {formatGNF(totalPayout)} GNF
              </span>
              {nextTurn && (
                <>
                  {" · "}prochain tour le{" "}
                  <span className="font-medium text-primary-foreground">
                    {new Date(nextTurn.due_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                  </span>
                </>
              )}
            </p>

            {/* 4 métriques */}
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <HeroMetric
                label="Cotisation"
                value={`${formatGNF(grp.contribution_amount)} GNF`}
              />
              <HeroMetric
                label="Prochain tour"
                value={nextTurn ? `#${nextTurn.turn_number}` : "—"}
                sub={nextTurn ? statusTurnLabel(nextTurn.status) : "À démarrer"}
              />
              <HeroMetric
                label="Membres"
                value={`${activeMembers.length} / ${grp.max_members}`}
              />
              <HeroMetric
                label="Fiabilité"
                value={avgReliabilityLabel(reliabilityQ.data ?? [])}
              />
            </dl>

            {/* Progression */}
            <div className="mt-6">
              <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-wider text-primary-foreground/70">
                <span>Progression du cycle</span>
                <span className="num">{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-primary-foreground/15">
                <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </article>

        {/* Barre d'actions billion-dollar */}
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-card/80 p-2 shadow-[0_6px_20px_-12px_hsl(var(--primary)/0.25)] backdrop-blur">
          <Link
            to={`/groupes/${grp.id}/membres`}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-700"
          >
            <Users className="h-4 w-4" />
            Voir membres
          </Link>
          <button
            type="button"
            onClick={() => {
              if (myDueForGroup && !paymentsBlocked) void launchDjomyCheckout(myDueForGroup.contribution_id);
            }}
            disabled={!myDueForGroup || paymentsBlocked}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-hairline bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"
          >
            <HandCoins className="h-4 w-4" />
            Gérer contributions
          </button>
          {isOrganizer && (
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById(INVITE_PANEL_ID);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-hairline bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-secondary"
            >
              <UserPlus className="h-4 w-4" />
              Inviter
            </button>
          )}
          <Link
            to={`/groupes/${grp.id}/parametres`}
            className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl border border-hairline bg-card px-4 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
            Paramètres
          </Link>
          <Link
            to="/parametres/notifications"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-hairline bg-card px-4 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            title="Régler vos rappels (prochain tour, cotisations dues) — in-app et email"
          >
            <Bell className="h-4 w-4" />
            Rappels
          </Link>
        </div>

        {canStart && (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-accent-200 bg-accent-50/60 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-600 text-accent-foreground">
                <Play className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-foreground">Prêt à démarrer le cycle</p>
                <p className="text-xs text-muted-foreground">
                  {activeMembers.length} membres actifs · l'ordre de rotation sera tiré et les {activeMembers.length} tours planifiés.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={startCycleM.isPending}
              onClick={() => startCycleM.mutate()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-accent-600 px-4 text-sm font-semibold text-accent-foreground transition hover:bg-accent-700 disabled:opacity-60"
            >
              {startCycleM.isPending ? "Démarrage…" : "Démarrer le cycle"}
            </button>
          </div>
        )}

        {paymentsBlocked && (
          <PausedPaymentsBanner
            isPaused={isPaused}
            grp={grp}
            organizerName={organizerProfileQ.data ?? null}
            myDue={myDueForGroup}
            myPendingRequest={
              myDueForGroup
                ? (pauseRequestsQ.data ?? []).find(
                    (r) =>
                      r.contribution_id === myDueForGroup.contribution_id &&
                      r.requested_by === user?.id &&
                      r.status === "pending",
                  ) ?? null
                : null
            }
            myApprovedRequest={
              myDueForGroup
                ? (pauseRequestsQ.data ?? []).find(
                    (r) =>
                      r.contribution_id === myDueForGroup.contribution_id &&
                      r.requested_by === user?.id &&
                      r.status === "approved" &&
                      new Date(r.expires_at).getTime() > Date.now(),
                  ) ?? null
                : null
            }
            myLastRejected={
              myDueForGroup
                ? (pauseRequestsQ.data ?? []).find(
                    (r) =>
                      r.contribution_id === myDueForGroup.contribution_id &&
                      r.requested_by === user?.id &&
                      r.status === "rejected",
                  ) ?? null
                : null
            }
            isOrganizer={isOrganizer}
            pendingRequests={(pauseRequestsQ.data ?? []).filter((r) => r.status === "pending")}
            onRequest={() =>
              myDueForGroup && requestPaymentM.mutate(myDueForGroup.contribution_id)
            }
            requestPending={requestPaymentM.isPending}
            onDecide={(requestId, approve) => decideRequestM.mutate({ requestId, approve })}
            decidePending={decideRequestM.isPending}
            onPay={() => myDueForGroup && void launchDjomyCheckout(myDueForGroup.contribution_id)}
          />
        )}

        {myDueForGroup && !paymentsBlocked && (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary-50/60 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-foreground">Votre cotisation est due</p>
                <p className="text-xs text-muted-foreground">
                  Tour #{myDueForGroup.turn_number} · {formatGNF(myDueForGroup.amount, { withCurrency: true })} ·
                  échéance {new Date(myDueForGroup.due_date).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void launchDjomyCheckout(myDueForGroup.contribution_id)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-700"
            >
              <ShieldCheck className="h-4 w-4" />
              Payer via Djomy
            </button>
          </div>
        )}

        {nextTurn && nextTurn.status === "collecting" && (
          <CurrentTurnBanner
            turn={nextTurn}
            currentUserId={user?.id ?? null}
            groupContribution={grp.contribution_amount}
          />
        )}

        {(() => {
          const me = activeMembers.find((m) => m.user_id === user?.id);
          if (!me) return null;
          return (
            <>
              <DepositCallout
                groupId={grp.id}
                groupName={grp.name}
                contributionAmount={grp.contribution_amount}
                depositRequired={!!(grp as { deposit_required?: boolean }).deposit_required}
                depositMonths={Number((grp as { deposit_months?: number }).deposit_months ?? 0)}
                memberDepositStatus={(me as { deposit_status?: string | null }).deposit_status ?? null}
              />
              {user?.id && <PositionBadge groupId={grp.id} userId={user.id} />}
              <ContractSignSection groupId={grp.id} />
            </>
          );
        })()}

        {isOrganizer && pendingMembers.length > 0 && (
          <div className="mt-5">
            <SectionCard
              title="Candidatures en attente"
              subtitle={`${pendingMembers.length} demande${pendingMembers.length > 1 ? "s" : ""}`}
              bare
            >
              <ul className="divide-y divide-border/60">
                {pendingMembers.map((m) => {
                  const name = m.profile?.full_name?.trim() || "Membre";
                  const initials = getInitials(name) || "··";
                  return (
                    <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 lg:px-6">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-sm font-bold text-foreground">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                        {m.profile?.phone_number && (
                          <p className="text-xs text-muted-foreground num">{m.profile.phone_number}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={approveM.isPending}
                        onClick={() => approveM.mutate(m.id)}
                        className="inline-flex h-9 items-center gap-1 rounded-md bg-success px-3 text-xs font-semibold text-success-foreground transition hover:opacity-90 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Accepter
                      </button>
                      <button
                        type="button"
                        disabled={rejectM.isPending}
                        onClick={() => rejectM.mutate(m.id)}
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-hairline px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        Refuser
                      </button>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          </div>
        )}

        {isOrganizer && (
          <InvitePanel
            groupId={grp.id}
            groupName={grp.name}
            contribution={grp.contribution_amount}
            frequency={frequency}
          />
        )}

        <AnnouncementsPanel groupId={grp.id} isOrganizer={isOrganizer} />

        <div className="mt-6 inline-flex items-center gap-1 rounded-lg border border-hairline bg-card p-1" role="tablist" aria-label="Sections du groupe">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={section === tab.id}
              onClick={() => setSection(tab.id)}
              className={cn(
                "rounded-md px-4 py-1.5 text-xs font-medium transition lg:text-sm",
                section === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {section === "overview" && <OverviewTab nextTurn={nextTurn} payout={totalPayout} />}
          {section === "overview" && (
            <>
              <GroupDefaultersSection groupId={grp.id} />
              <GroupDisputesSection groupId={grp.id} />
            </>
          )}
          {section === "members" && (
            <MembersTab
              members={activeMembers}
              reliability={reliabilityQ.data ?? []}
              canManage={canManageMembers}
              groupId={grp.id}
            />
          )}
          {section === "rotation" && (
            <RotationTab
              turns={turns}
              userId={user?.id ?? null}
              isOrganizer={isOrganizer}
              onPayout={(turnId) => payoutM.mutate(turnId)}
              payingTurnId={payoutM.isPending ? (payoutM.variables as string | undefined) ?? null : null}
              ledger={ledgerQ.data ?? []}
            />
          )}
          {section === "chat" && <GroupChat groupId={grp.id} />}
          {section === "invitations" && isOrganizer && (
            <InvitationsHistoryPanel groupId={grp.id} canManage={isOrganizer} />
          )}
          {section === "swaps" && (
            <SwapsPanel
              groupId={grp.id}
              currentUserId={user?.id ?? null}
              swapPolicy={grp.swap_policy ?? "with_consent"}
            />
          )}
          {section === "auctions" && (
            <AuctionPanel
              groupId={grp.id}
              currentUserId={user?.id ?? null}
              isOrganizer={isOrganizer}
            />
          )}
          {section === "reviews" && (
            <ReviewsPanel
              groupId={grp.id}
              currentUserId={user?.id ?? null}
            />
          )}
          {section === "audit" && isOrganizer && <AuditLog groupId={grp.id} />}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md px-3 py-2 lg:flex lg:items-center lg:justify-between">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-sm font-bold text-foreground num lg:mt-0">{value}</p>
    </div>
  );
}

function HeroMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 px-3 py-2.5 backdrop-blur">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-primary-foreground/70">
        {label}
      </p>
      <p className="mt-1 font-display text-base font-bold text-primary-foreground num">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-primary-foreground/70">{sub}</p>}
    </div>
  );
}

function avgReliabilityLabel(rows: DbGroupReliabilityRow[]): string {
  if (!rows.length) return "—";
  const scores = rows
    .map((r) => (typeof r.score === "number" ? r.score : null))
    .filter((s): s is number => s !== null);
  if (!scores.length) return "—";
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return `${Math.round(avg)}/100`;
}

function OverviewTab({ nextTurn, payout }: { nextTurn: DbNextTurn | null; payout: number }) {
  if (!nextTurn) {
    return (
      <SectionCard title="Cycle non démarré" subtitle="Aucun tour planifié">
        <p className="text-sm text-muted-foreground">
          Le cycle n'a pas encore été lancé. Une fois le quorum atteint (au moins 2 membres actifs), l'organisateur peut démarrer la rotation.
        </p>
      </SectionCard>
    );
  }
  const dueLabel = new Date(nextTurn.due_date).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const initials = getInitials(nextTurn.beneficiary_name ?? "··");
  return (
    <article className="rounded-xl border border-accent-100 bg-accent-50/60 p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-600 text-base font-bold text-accent-foreground">
          {initials || "··"}
        </div>
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-wider text-accent-700">
            {nextTurn.status === "collecting" ? "Bénéficiaire en cours" : "Prochain bénéficiaire"}
          </p>
          <p className="font-display text-base font-bold text-foreground">
            {nextTurn.beneficiary_name ?? "Membre"}
          </p>
          <p className="text-xs text-muted-foreground">
            Tour #{nextTurn.turn_number} · échéance {dueLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Reçoit</p>
          <p className="font-display text-lg font-bold text-accent-700 num">
            {formatGNF(payout, { withCurrency: true })}
          </p>
        </div>
      </div>
    </article>
  );
}

function MembersTab({
  members,
  reliability,
  canManage,
  groupId,
}: {
  members: DbGroupMember[];
  reliability: DbGroupReliabilityRow[];
  canManage: boolean;
  groupId: string;
}) {
  const scoreMap = new Map(reliability.map((r) => [r.user_id, r]));
  return (
    <div className="space-y-4">
      {canManage && (
        <Link
          to={`/groupes/${groupId}/membres`}
          className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary-50/40 px-4 py-3 text-sm transition hover:bg-primary-50"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold text-foreground">Gérer les membres</span>
              <span className="text-xs text-muted-foreground">
                Suspendre, exclure, permissions, co-organisateurs
              </span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}
      <SectionCard title="Membres actifs" subtitle={`${members.length} participants`} bare>
      <ul className="divide-y divide-border/60">
        {members.map((m) => {
          const name = m.profile?.full_name?.trim() || "Membre";
          const initials = getInitials(name) || "··";
          const rel = scoreMap.get(m.user_id);
          return (
            <li key={m.id} className="flex items-center gap-3 px-5 py-3.5 lg:px-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-sm font-bold text-foreground">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                  {m.role === "organisateur" && (
                    <span className="rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-700">
                      Organisateur
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {m.position != null && <span>Position #{m.position}</span>}
                  {m.profile?.phone_number && (
                    <>
                      <span>·</span>
                      <span className="num">{m.profile.phone_number}</span>
                    </>
                  )}
                </div>
              </div>
              {rel ? (
                <ReliabilityBadge score={rel.score} tier={rel.tier} />
              ) : (
                <Star className="h-4 w-4 text-muted-foreground/40" />
              )}
            </li>
          );
        })}
        {members.length === 0 && (
          <li className="px-5 py-6 text-sm text-muted-foreground lg:px-6">
            Aucun membre actif pour le moment.
          </li>
        )}
      </ul>
      </SectionCard>
    </div>
  );
}

function RotationTab({
  turns,
  userId,
  isOrganizer,
  onPayout,
  payingTurnId,
  ledger,
}: {
  turns: DbNextTurn[];
  userId: string | null;
  isOrganizer: boolean;
  onPayout: (turnId: string) => void;
  payingTurnId: string | null;
  ledger: import("@/lib/api/payouts").DbLedgerRow[];
}) {
  if (turns.length === 0) {
    return (
      <SectionCard title="Calendrier de rotation" subtitle="Aucun tour planifié">
        <p className="text-sm text-muted-foreground">
          Le cycle n'a pas été démarré. Les tours apparaîtront ici une fois la rotation lancée.
        </p>
      </SectionCard>
    );
  }
  return (
    <div className="space-y-5">
    <SectionCard title="Calendrier de rotation" subtitle={`${turns.length} tours planifiés`} bare>
      <ul className="divide-y divide-border/60">
        {turns.map((t) => {
          const dueLabel = new Date(t.due_date).toLocaleDateString("fr-FR", {
            day: "2-digit", month: "short",
          });
          const isYou = t.beneficiary_user_id === userId;
          const canPay = isOrganizer && t.status === "collecting";
          const paying = payingTurnId === t.turn_id;
          return (
            <li key={t.turn_id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 lg:px-6">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md text-xs font-bold num",
                  t.status === "paid"
                    ? "bg-success/10 text-success"
                    : t.status === "collecting"
                    ? "bg-accent-600 text-accent-foreground"
                    : "bg-secondary text-foreground",
                )}
              >
                #{t.turn_number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {t.beneficiary_name ?? "Membre"} {isYou && <span className="text-accent-700">(vous)</span>}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {dueLabel} · {statusTurnLabel(t.status)}
                </p>
              </div>
              <p className="font-display text-sm font-semibold text-foreground num">
                {formatGNF(t.payout_amount, { withCurrency: true })}
              </p>
              {canPay && (
                <button
                  type="button"
                  disabled={paying}
                  onClick={() => {
                    if (window.confirm(`Verser ${formatGNF(t.payout_amount, { withCurrency: true })} GNF à ${t.beneficiary_name ?? "le bénéficiaire"} ?`)) {
                      onPayout(t.turn_id);
                    }
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-xs font-semibold text-accent-foreground transition hover:bg-accent-700 disabled:opacity-60"
                >
                  <HandCoins className="h-3.5 w-3.5" />
                  {paying ? "Versement…" : "Verser"}
                </button>
              )}
              {t.status === "paid" && isYou && (
                <Link
                  to="/recus"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-foreground transition hover:bg-secondary"
                >
                  <FileCheck2 className="h-3.5 w-3.5" />
                  Reçu
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </SectionCard>

    {ledger.length > 0 && (
      <SectionCard title="Registre du groupe" subtitle="Dernières opérations" bare>
        <ul className="divide-y divide-border/60">
          {ledger.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-5 py-3 lg:px-6">
              <span className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md text-[10px] font-bold uppercase",
                e.amount >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}>
                {e.amount >= 0 ? "+" : "−"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{e.memo ?? e.entry_type}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {e.user_name ? ` · ${e.user_name}` : ""}
                </p>
              </div>
              <p className="font-display text-sm font-semibold num text-foreground">
                {formatGNF(Math.abs(e.amount))} GNF
              </p>
            </li>
          ))}
        </ul>
      </SectionCard>
    )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PausedPaymentsBanner — explique pourquoi le paiement est bloqué et permet
// de demander/accorder une autorisation exceptionnelle pendant la pause.
// ---------------------------------------------------------------------------
interface PausedPaymentsBannerProps {
  isPaused: boolean;
  grp: DbGroup;
  organizerName: string | null;
  myDue: { contribution_id: string; amount: number; turn_number: number; due_date: string } | undefined;
  myPendingRequest: PausePaymentRequest | null;
  myApprovedRequest: PausePaymentRequest | null;
  myLastRejected: PausePaymentRequest | null;
  isOrganizer: boolean;
  pendingRequests: PausePaymentRequest[];
  onRequest: () => void;
  requestPending: boolean;
  onDecide: (requestId: string, approve: boolean) => void;
  decidePending: boolean;
  onPay: () => void;
}

function PausedPaymentsBanner(props: PausedPaymentsBannerProps) {
  const {
    isPaused, grp, organizerName, myDue,
    myPendingRequest, myApprovedRequest, myLastRejected,
    isOrganizer, pendingRequests,
    onRequest, requestPending, onDecide, decidePending, onPay,
  } = props;

  const pausedDate = grp.paused_at
    ? new Date(grp.paused_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : null;
  const orgLabel = organizerName?.trim() || "l'organisateur";

  return (
    <div className="mt-5 space-y-3 rounded-xl border border-amber-500/30 bg-amber-50/60 p-4 dark:bg-amber-500/10">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-foreground">
            {isPaused ? "Cycle en pause — paiements suspendus" : "Cycle clôturé"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isPaused ? (
              <>
                {orgLabel} a mis ce cycle en pause
                {pausedDate ? ` le ${pausedDate}` : ""}
                {grp.paused_reason ? ` — motif : « ${grp.paused_reason} »` : ""}. Aucune cotisation ne peut être réglée tant que le cycle n'a pas repris.
              </>
            ) : (
              "Ce groupe est archivé : aucun nouveau paiement ne peut être effectué."
            )}
          </p>
        </div>
      </div>

      {/* Côté membre — workflow d'autorisation */}
      {isPaused && !isOrganizer && myDue && (
        <div className="rounded-lg border border-hairline bg-card/80 p-3">
          {myApprovedRequest ? (
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-xs text-foreground">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-primary" />
                {orgLabel} vous a autorisé(e) à régler votre cotisation malgré la pause.
              </p>
              <button
                type="button"
                onClick={onPay}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Payer via Djomy
              </button>
            </div>
          ) : myPendingRequest ? (
            <p className="text-xs text-muted-foreground">
              Votre demande d'autorisation est en attente de réponse de {orgLabel}. Vous serez notifié(e) dès qu'une décision sera prise.
            </p>
          ) : (
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs text-foreground">
                  Vous pouvez demander une autorisation exceptionnelle pour régler votre tour #{myDue.turn_number} ({formatGNF(myDue.amount, { withCurrency: true })}).
                </p>
                {myLastRejected && (
                  <p className="mt-1 text-[11px] text-destructive">
                    Précédente demande refusée{myLastRejected.decision_reason ? ` — motif : « ${myLastRejected.decision_reason} »` : ""}.
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={requestPending}
                onClick={onRequest}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 text-xs font-semibold text-primary transition hover:bg-primary/15 disabled:opacity-60"
              >
                {requestPending ? "Envoi…" : "Demander l'autorisation de payer"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Côté organisateur — liste des demandes en attente */}
      {isPaused && isOrganizer && pendingRequests.length > 0 && (
        <div className="rounded-lg border border-hairline bg-card/80 p-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Demandes d'autorisation ({pendingRequests.length})
          </p>
          <ul className="space-y-2">
            {pendingRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-foreground">
                  {r.requester_name?.trim() || "Membre"}
                  <span className="ml-2 text-muted-foreground">
                    · demandé le {new Date(r.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={decidePending}
                    onClick={() => onDecide(r.id, false)}
                    className="inline-flex h-8 items-center rounded-md border border-hairline bg-card px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary disabled:opacity-60"
                  >
                    Refuser
                  </button>
                  <button
                    type="button"
                    disabled={decidePending}
                    onClick={() => onDecide(r.id, true)}
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Autoriser
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
