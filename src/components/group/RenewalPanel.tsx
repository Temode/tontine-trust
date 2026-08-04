import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, RefreshCw, ShieldCheck, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatGNF, getInitials } from "@/lib/format";
import {
  cancelRenewal, extendRenewal, getRenewalStatus, startRenewedCycle, voteRenewal,
} from "@/lib/api/renewal";
import { RenewalLaunchDialog } from "./RenewalLaunchDialog";
import { RenewalVoteDialog } from "./RenewalVoteDialog";

interface Props {
  groupId: string;
  /** True when the current user can pilot the renewal (group organizer). */
  isOrganizer: boolean;
  /** True when the last cycle is over (group completed / archived). */
  cycleFinished: boolean;
}

function countdown(deadline?: string | null): { label: string; urgent: boolean; over: boolean } {
  if (!deadline) return { label: "", urgent: false, over: false };
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return { label: "Délai expiré", urgent: true, over: true };
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days >= 1) return { label: `${days} j ${hours} h restantes`, urgent: days <= 1, over: false };
  return { label: `${hours} h restantes`, urgent: true, over: false };
}

export function RenewalPanel({ groupId, isOrganizer, cycleFinished }: Props) {
  const qc = useQueryClient();
  const [tick, setTick] = useState(0);
  const [openLaunch, setOpenLaunch] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [voteOpen, setVoteOpen] = useState(false);

  const statusQ = useQuery({
    queryKey: ["group", groupId, "renewal"],
    queryFn: () => getRenewalStatus(groupId),
    enabled: !!groupId,
  });

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`renewal-${groupId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cycle_renewal_votes" }, () => {
        void qc.invalidateQueries({ queryKey: ["group", groupId, "renewal"] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cycles", filter: `group_id=eq.${groupId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["group", groupId, "renewal"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId, qc]);

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["group", groupId] });
    void qc.invalidateQueries({ queryKey: ["group", groupId, "renewal"] });
    void qc.invalidateQueries({ queryKey: ["group", groupId, "turns"] });
    void qc.invalidateQueries({ queryKey: ["group", groupId, "members"] });
  };

  const st = statusQ.data;

  const voteM = useMutation({
    mutationFn: (agreed: boolean) => voteRenewal(st?.cycle_id ?? "", agreed),
    onSuccess: (_d, agreed) => {
      toast.success(agreed ? "Participation confirmée" : "Réponse enregistrée");
      invalidateAll();
    },
    onError: (e: Error) => toast.error("Réponse impossible", { description: e.message }),
  });

  const startM = useMutation({
    mutationFn: () => startRenewedCycle(groupId),
    onSuccess: () => {
      toast.success("Nouveau cycle démarré");
      setConfirmStart(false);
      invalidateAll();
    },
    onError: (e: Error) => toast.error("Démarrage impossible", { description: e.message }),
  });

  const extendM = useMutation({
    mutationFn: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return extendRenewal(st?.cycle_id ?? "", d.toISOString());
    },
    onSuccess: () => {
      toast.success("Délai prolongé de 7 jours");
      invalidateAll();
    },
    onError: (e: Error) => toast.error("Prolongation impossible", { description: e.message }),
  });

  const cancelM = useMutation({
    mutationFn: () => cancelRenewal(st?.cycle_id ?? ""),
    onSuccess: () => {
      toast.success("Relance annulée");
      setConfirmCancel(false);
      invalidateAll();
    },
    onError: (e: Error) => toast.error("Annulation impossible", { description: e.message }),
  });

  const cd = useMemo(() => countdown(st?.deadline), [st?.deadline, tick]);

  // « Je participe » passe par la modale détail du cycle + acceptation des conditions.
  const submitVote = (agreed: boolean) => {
    if (agreed) {
      setVoteOpen(true);
      return;
    }
    voteM.mutate(false);
  };

  // Rien à afficher tant que le cycle n'est pas terminé et qu'aucune relance n'est ouverte.
  if (!st) return null;
  if (!st.open && !(cycleFinished && isOrganizer)) return null;

  // ------- Etat 1 : l'organisateur peut ouvrir une relance -------
  if (!st.open) {
    return (
      <>
        <section className="mt-4 rounded-2xl border-2 border-accent-300 bg-accent-50/70 p-5 shadow-[0_10px_30px_-18px_hsl(var(--primary)/0.45)] lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-600 text-accent-foreground">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-700">
                  Cycle terminé
                </p>
                <p className="font-display text-lg font-bold text-foreground">
                  Le cycle {st.cycle_number} est terminé — relancer une nouvelle tontine
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Chaque membre devra confirmer sa participation : aucun engagement n'est reconduit
                  automatiquement.
                </p>
              </div>
            </div>
            {isOrganizer ? (
              <Button size="lg" className="shrink-0" onClick={() => setOpenLaunch(true)}>
                Préparer la relance
              </Button>
            ) : (
              <p className="shrink-0 text-xs text-muted-foreground">
                L'organisateur peut relancer un nouveau cycle.
              </p>
            )}
          </div>
        </section>
        <RenewalLaunchDialog
          open={openLaunch}
          onOpenChange={setOpenLaunch}
          groupId={groupId}
          previousMembers={st.previous_members ?? st.eligible ?? 2}
          eligible={st.eligible ?? 2}
          contribution={st.contribution_amount ?? 0}
          onDone={invalidateAll}
        />
      </>
    );
  }

  // ------- Etat 2 : relance en cours -------
  const eligible = st.eligible ?? 0;
  const accepted = st.accepted ?? 0;
  const declined = st.declined ?? 0;
  const pending = st.pending ?? 0;
  const min = st.min_members ?? 2;
  const thresholdReached = accepted >= min;
  const pct = eligible > 0 ? Math.round((accepted / eligible) * 100) : 0;
  const minPct = eligible > 0 ? Math.round((min / eligible) * 100) : 0;
  const prevPayout = st.previous_payout ?? 0;
  const projected = st.projected_payout ?? 0;
  const drop = prevPayout > 0 ? Math.round(((prevPayout - projected) / prevPayout) * 100) : 0;
  const names = (st.confirmed_names ?? []).filter(Boolean) as string[];

  return (
    <>
      <section className="mt-5 overflow-hidden rounded-xl border border-accent-200 bg-accent-50/50">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent-200/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-accent-700" />
            <p className="font-display text-sm font-bold text-foreground">
              Nouveau cycle proposé
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              cd.urgent ? "bg-destructive/10 text-destructive" : "bg-card text-muted-foreground"
            }`}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            {cd.label}
          </span>
        </div>

        <div className="space-y-4 p-4">
          {/* Preuve sociale */}
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <p className="font-semibold text-foreground">
                {accepted} membre{accepted > 1 ? "s" : ""} sur {eligible} ont confirmé
              </p>
              <p className="text-xs text-muted-foreground">
                {declined} refus · {pending} en attente
              </p>
            </div>
            <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-accent-600 transition-all"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
              <div
                className="absolute top-0 h-full w-0.5 bg-foreground/50"
                style={{ left: `${Math.min(minPct, 100)}%` }}
                title={`Seuil : ${min} participants`}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Seuil de viabilité : {min} participants ·{" "}
              {thresholdReached ? "atteint" : `encore ${min - accepted} à confirmer`}
            </p>
            {names.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {names.slice(0, 8).map((n) => (
                  <span
                    key={n}
                    title={n}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-600/15 text-[10px] font-bold text-accent-700"
                  >
                    {getInitials(n)}
                  </span>
                ))}
                {names.length > 8 && (
                  <span className="text-[11px] text-muted-foreground">+{names.length - 8}</span>
                )}
              </div>
            )}
          </div>

          {/* Conditions & réassurance */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-hairline bg-card p-3 sm:grid-cols-4">
            <Stat label="Cotisation" value={formatGNF(st.contribution_amount ?? 0, { withCurrency: true })} />
            <Stat label="Pot par tour (projeté)" value={formatGNF(projected, { withCurrency: true })} />
            <Stat label="Tours" value={`${st.projected_turns ?? accepted}`} />
            <Stat
              label="Cycle précédent"
              value={`${st.previous_members ?? 0} membres · ${formatGNF(prevPayout, { compact: true })}`}
            />
          </div>
          <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Aucun prélèvement n'est effectué maintenant. Votre réponse reste modifiable jusqu'à la
            date limite, et le cycle ne démarre qu'après validation de l'organisateur.
          </p>

          {/* Vote membre */}
          {!st.is_organizer && !cd.over && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => submitVote(true)}
                disabled={voteM.isPending}
                variant={st.my_vote === true ? "default" : "outline"}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Je participe
              </Button>
              <Button
                onClick={() => submitVote(false)}
                disabled={voteM.isPending}
                variant={st.my_vote === false ? "destructive" : "outline"}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Je ne participe pas
              </Button>
              {st.my_vote === null || st.my_vote === undefined ? (
                <p className="text-[11px] text-muted-foreground">
                  Sans réponse avant le{" "}
                  {st.deadline ? new Date(st.deadline).toLocaleDateString("fr-FR") : ""}, votre place
                  sera proposée à un autre membre.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Réponse enregistrée — modifiable jusqu'à la date limite.
                </p>
              )}
            </div>
          )}
          {!st.is_organizer && cd.over && (
            <p className="text-xs text-muted-foreground">
              Le délai de réponse est clos. L'organisateur finalise la liste des participants.
            </p>
          )}

          {/* Pilotage organisateur */}
          {st.is_organizer && (
            <div className="space-y-3 rounded-lg border border-hairline bg-card p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Users className="h-4 w-4 text-primary" />
                Simulation du nouveau cycle
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>
                  Participants confirmés : <strong className="text-foreground">{accepted}</strong>{" "}
                  (cycle précédent : {st.previous_members ?? 0})
                </li>
                <li>
                  Pot par tour :{" "}
                  <strong className="text-foreground">
                    {formatGNF(prevPayout, { withCurrency: true })} →{" "}
                    {formatGNF(projected, { withCurrency: true })}
                  </strong>
                  {drop > 0 && <span className="text-destructive"> (-{drop} %)</span>}
                </li>
                <li>
                  Rotation entièrement régénérée sur les seuls membres confirmés ; les membres non
                  confirmés quittent le groupe.
                </li>
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setConfirmStart(true)}
                  disabled={!thresholdReached || accepted < 2 || startM.isPending}
                >
                  Démarrer le cycle ({accepted} participants)
                </Button>
                <Button variant="outline" onClick={() => extendM.mutate()} disabled={extendM.isPending}>
                  Prolonger de 7 jours
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmCancel(true)}
                  disabled={cancelM.isPending}
                >
                  Annuler la relance
                </Button>
              </div>
              {!thresholdReached && (
                <p className="text-[11px] text-muted-foreground">
                  Le seuil de {min} participants n'est pas atteint : prolongez le délai ou relancez
                  les membres en attente.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <AlertDialog open={confirmStart} onOpenChange={setConfirmStart}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Démarrer le nouveau cycle ?</AlertDialogTitle>
            <AlertDialogDescription>
              {accepted} participants confirmés, {accepted} tours planifiés, pot de{" "}
              {formatGNF(projected, { withCurrency: true })} par tour
              {drop > 20
                ? ` — soit ${drop} % de moins que le cycle précédent (${formatGNF(prevPayout, { withCurrency: true })}). Les membres en seront informés.`
                : "."}{" "}
              Les membres non confirmés quitteront le groupe et l'ordre de rotation sera retiré au
              sort parmi les participants confirmés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                startM.mutate();
              }}
            >
              {startM.isPending ? "Démarrage…" : "Confirmer le démarrage"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la demande de relance ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le nouveau cycle ne démarrera pas et toutes les réponses déjà enregistrées seront
              abandonnées. Tous les membres du groupe en seront informés (application, email, et SMS
              s'ils disposent d'un forfait actif). Vous pourrez relancer une nouvelle demande plus
              tard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revenir</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cancelM.mutate();
              }}
            >
              {cancelM.isPending ? "Annulation…" : "Confirmer l'annulation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TermsAcceptDialog
        open={termsOpen}
        onOpenChange={(v) => {
          setTermsOpen(v);
          if (!v) setPendingVote(null);
        }}
        groupId={groupId}
        ctaLabel="J'accepte et je participe"
        onAccepted={() => {
          if (pendingVote !== null) voteM.mutate(pendingVote);
          setPendingVote(null);
        }}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}