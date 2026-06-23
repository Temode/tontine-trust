import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Save, Lock, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import {
  getGroup,
  getGroupEditWindow,
  updateGroupSettings,
  type GroupEditWindow,
  type UpdateGroupSettingsPayload,
} from "@/lib/api/groups";
import { useAuth } from "@/hooks/useAuth";
import { MembersAdminPanel } from "@/components/group/MembersAdminPanel";
import { ExternalPaymentsPanel } from "@/components/group/ExternalPaymentsPanel";
import { PaymentsHistoryPanel } from "@/components/group/PaymentsHistoryPanel";
import { CycleAdminPanel } from "@/components/group/CycleAdminPanel";
import { DeletionPanel } from "@/components/group/DeletionPanel";
import { ShieldCheck, ChevronRight } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FREQ_OPTIONS = [
  { value: "quotidienne", label: "Quotidienne (1 jour)" },
  { value: "hebdomadaire", label: "Hebdomadaire" },
  { value: "quinzaine", label: "Quinzaine" },
  { value: "mensuelle", label: "Mensuelle" },
] as const;

const ROTATION_OPTIONS = [
  { value: "random", label: "Tirage au sort" },
  { value: "fixed", label: "Ordre fixe" },
  { value: "auction", label: "Enchères" },
  { value: "choice", label: "Choix individuel" },
] as const;

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Privé · sur invitation" },
  { value: "public-link", label: "Lien partageable" },
  { value: "directory", label: "Annuaire public" },
] as const;

const INPUT_CLASS =
  "w-full rounded-md border border-hairline bg-card px-3 py-2 text-sm text-foreground transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";

export default function GroupSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: group, isLoading } = useQuery({
    queryKey: ["group", id],
    queryFn: () => getGroup(id as string),
    enabled: !!id,
  });

  const isOrganizer = !!user?.id && !!group && group.created_by === user.id;

  const { data: editWindow } = useQuery({
    queryKey: ["group-edit-window", id],
    queryFn: () => getGroupEditWindow(id as string),
    enabled: !!id && isOrganizer,
    refetchOnWindowFocus: false,
  });

  const window: GroupEditWindow = editWindow ?? "pre_cycle";
  const locked = window === "locked";
  const inCycle = window === "in_cycle";
  const structuralLocked = inCycle || locked;

  const [form, setForm] = useState<UpdateGroupSettingsPayload>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (group) {
      setForm({
        name: group.name,
        description: group.description ?? "",
        contribution_amount: group.contribution_amount,
        frequency: group.frequency,
        max_members: group.max_members,
        rotation_order_kind: group.rotation_order_kind,
        late_penalty_percent: group.late_penalty_percent,
        late_penalty_after_days: group.late_penalty_after_days,
        visibility: group.visibility ?? "private",
      });
    }
  }, [group]);

  const saveM = useMutation({
    mutationFn: () => updateGroupSettings(id as string, form),
    onSuccess: () => {
      toast.success("Paramètres enregistrés");
      queryClient.invalidateQueries({ queryKey: ["group", id] });
      queryClient.invalidateQueries({ queryKey: ["my-groups"] });
      queryClient.invalidateQueries({ queryKey: ["group-edit-window", id] });
      navigate(`/groupes/${id}`);
    },
    onError: (e: Error) =>
      toast.error("Modification impossible", { description: e.message }),
  });

  const update = <K extends keyof UpdateGroupSettingsPayload>(
    key: K,
    value: UpdateGroupSettingsPayload[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const totalPayout = useMemo(
    () => (form.contribution_amount ?? 0) * (form.max_members ?? 0),
    [form.contribution_amount, form.max_members],
  );

  const structuralDiff = useMemo(() => {
    if (!group) return [] as { label: string; from: string; to: string }[];
    const out: { label: string; from: string; to: string }[] = [];
    if (
      form.contribution_amount !== undefined &&
      form.contribution_amount !== group.contribution_amount
    ) {
      out.push({
        label: "Cotisation",
        from: `${group.contribution_amount.toLocaleString("fr-FR")} GNF`,
        to: `${form.contribution_amount.toLocaleString("fr-FR")} GNF`,
      });
    }
    if (form.frequency && form.frequency !== group.frequency) {
      out.push({ label: "Fréquence", from: String(group.frequency), to: form.frequency });
    }
    if (form.max_members !== undefined && form.max_members !== group.max_members) {
      out.push({
        label: "Membres max.",
        from: String(group.max_members),
        to: String(form.max_members),
      });
    }
    if (
      form.rotation_order_kind &&
      form.rotation_order_kind !== group.rotation_order_kind
    ) {
      out.push({
        label: "Rotation",
        from: String(group.rotation_order_kind),
        to: form.rotation_order_kind,
      });
    }
    return out;
  }, [form, group]);

  const handleSave = () => {
    if (window === "between_cycles" && structuralDiff.length > 0) {
      setConfirmOpen(true);
      return;
    }
    saveM.mutate();
  };

  if (isLoading || !group) {
    return (
      <div className="px-6 py-12 text-sm text-muted-foreground">Chargement…</div>
    );
  }

  if (!isOrganizer) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <Lock className="mb-3 h-8 w-8 text-muted-foreground" />
        <h2 className="font-display text-lg font-bold text-foreground">
          Accès réservé à l'organisateur
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vous n'avez pas la permission de modifier les paramètres de ce groupe.
        </p>
        <Link
          to={`/groupes/${id}`}
          className="mt-6 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Retour au groupe
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <TopBar
        title={`Paramètres · ${group.name}`}
        subtitle="Ajustez les règles du groupe avant le démarrage du cycle."
      />
      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <button
          type="button"
          onClick={() => navigate(`/groupes/${id}`)}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-hairline px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour au groupe
        </button>

        <EditWindowBanner window={window} />

        <SectionCard title="Identité" subtitle="Nom et description du groupe">
          <div className="space-y-4">
            <Field label="Nom du groupe">
              <input
                type="text"
                value={form.name ?? ""}
                disabled={locked}
                onChange={(e) => update("name", e.target.value)}
                className={INPUT_CLASS}
                maxLength={120}
              />
            </Field>
            <Field label="Description (optionnelle)">
              <textarea
                value={form.description ?? ""}
                disabled={locked}
                onChange={(e) => update("description", e.target.value)}
                className={`${INPUT_CLASS} min-h-[80px] resize-y`}
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Paramètres financiers"
          subtitle={`Cagnotte par tour : ${totalPayout.toLocaleString("fr-FR")} GNF`}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Cotisation (GNF)" locked={structuralLocked}>
              <input
                type="number"
                min={1000}
                step={1000}
                value={form.contribution_amount ?? 0}
                disabled={structuralLocked}
                onChange={(e) => update("contribution_amount", Number(e.target.value))}
                className={`${INPUT_CLASS} num`}
              />
            </Field>
            <Field label="Nombre de membres" locked={structuralLocked}>
              <input
                type="number"
                min={2}
                max={100}
                value={form.max_members ?? 0}
                disabled={structuralLocked}
                onChange={(e) => update("max_members", Number(e.target.value))}
                className={`${INPUT_CLASS} num`}
              />
            </Field>
            <Field label="Fréquence" locked={structuralLocked}>
              <select
                value={form.frequency ?? "mensuelle"}
                disabled={structuralLocked}
                onChange={(e) => update("frequency", e.target.value as UpdateGroupSettingsPayload["frequency"])}
                className={INPUT_CLASS}
              >
                {FREQ_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Ordre de rotation" locked={structuralLocked}>
              <select
                value={form.rotation_order_kind ?? "random"}
                disabled={structuralLocked}
                onChange={(e) => update("rotation_order_kind", e.target.value as UpdateGroupSettingsPayload["rotation_order_kind"])}
                className={INPUT_CLASS}
              >
                {ROTATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Pénalités de retard" subtitle="Appliquées au moment du paiement">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Pénalité (%)" locked={structuralLocked}>
              <input
                type="number"
                min={0}
                max={100}
                value={form.late_penalty_percent ?? 0}
                disabled={structuralLocked}
                onChange={(e) => update("late_penalty_percent", Number(e.target.value))}
                className={`${INPUT_CLASS} num`}
              />
            </Field>
            <Field label="Délai de grâce (jours)" locked={structuralLocked}>
              <input
                type="number"
                min={0}
                value={form.late_penalty_after_days ?? 0}
                disabled={structuralLocked}
                onChange={(e) => update("late_penalty_after_days", Number(e.target.value))}
                className={`${INPUT_CLASS} num`}
              />
            </Field>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Exemple : 5% au-delà de 3 jours = pénalité automatique de{" "}
            <strong className="num">
              {(((form.contribution_amount ?? 0) * (form.late_penalty_percent ?? 0)) / 100).toLocaleString("fr-FR")} GNF
            </strong>{" "}
            pour tout paiement effectué après le délai.
          </p>
          <div className="mt-4 rounded-lg border border-hairline bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Escalade automatique en cas de retard prolongé</p>
            <ul className="space-y-0.5">
              <li>• J-2, J-1, J0 : SMS de rappel d'échéance</li>
              <li>• J+1, J+3 : SMS de retard avec montant de la pénalité encourue</li>
              <li>• J+7 : signalement automatique de défaut transmis aux organisateurs</li>
              <li>• J+14 : suspension automatique du membre (vote, enchères) jusqu'au règlement</li>
            </ul>
          </div>
        </SectionCard>

        <SectionCard title="Visibilité" subtitle="Qui peut découvrir et rejoindre ce groupe">
          <div className="space-y-2">
            {VISIBILITY_OPTIONS.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-hairline px-4 py-3 text-sm transition hover:bg-secondary/50 has-[:checked]:border-primary has-[:checked]:bg-primary-50"
              >
                <input
                  type="radio"
                  name="visibility"
                  value={o.value}
                  checked={form.visibility === o.value}
                  disabled={locked}
                  onChange={() => update("visibility", o.value)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="font-medium text-foreground">{o.label}</span>
              </label>
            ))}
          </div>
        </SectionCard>

        {user?.id && (
          <MembersAdminPanel
            groupId={group.id}
            currentUserId={user.id}
            ownerUserId={group.created_by}
          />
        )}

        <Link
          to={`/groupes/${id}/co-organisateurs`}
          className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary-50/40 px-4 py-3 text-sm transition hover:bg-primary-50"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold text-foreground">Co-organisateurs</span>
              <span className="text-xs text-muted-foreground">
                Page dédiée · permissions granulaires et historique
              </span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>

        <SectionCard title="Paiements externes" subtitle="Cash, virement, mobile money hors-app à valider">
          <ExternalPaymentsPanel groupId={group.id} />
        </SectionCard>

        <SectionCard title="Historique des paiements" subtitle="Toutes les cotisations reçues">
          <PaymentsHistoryPanel groupId={group.id} />
        </SectionCard>

        <SectionCard title="Cycle" subtitle="Pause, reprise, archivage">
          <CycleAdminPanel groupId={group.id} status={group.status} />
        </SectionCard>

        {user?.id && (
          <SectionCard title="Suppression du groupe" subtitle="Vote des membres puis validation Tontine">
            <DeletionPanel
              groupId={group.id}
              isOrganizer={isOrganizer}
              currentUserId={user.id}
            />
          </SectionCard>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(`/groupes/${id}`)}
            className="h-10 rounded-md border border-hairline px-4 text-sm font-medium text-muted-foreground transition hover:bg-secondary"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={locked || saveM.isPending}
            onClick={handleSave}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saveM.isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer les changements structurels</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Vous êtes entre deux cycles. Les modifications suivantes
                  affecteront le prochain cycle et seront notifiées à tous les
                  membres :
                </p>
                <ul className="rounded-md border border-hairline bg-secondary/40 p-3 text-xs">
                  {structuralDiff.map((d) => (
                    <li key={d.label} className="flex justify-between gap-2 py-0.5">
                      <span className="font-medium text-foreground">{d.label}</span>
                      <span className="text-muted-foreground">
                        {d.from} → <strong className="text-foreground">{d.to}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Ce changement sera consigné dans l'historique d'audit et
                  enregistré comme consentement de l'organisateur.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                saveM.mutate();
              }}
            >
              Confirmer et notifier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({
  label,
  children,
  locked,
}: {
  label: string;
  children: React.ReactNode;
  locked?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {locked && (
          <Lock className="h-3 w-3" aria-label="Verrouillé pendant un cycle" />
        )}
      </span>
      {children}
    </label>
  );
}

function EditWindowBanner({ window: w }: { window: GroupEditWindow }) {
  if (w === "locked") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
        <Lock className="mt-0.5 h-4 w-4 text-warning" />
        <p className="text-foreground">
          <strong>Groupe clôturé.</strong> La configuration ne peut plus être modifiée.
        </p>
      </div>
    );
  }
  if (w === "in_cycle") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-hairline bg-secondary/40 px-4 py-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <p className="text-foreground">
          <strong>Cycle en cours.</strong> Seuls le nom, la description et la
          visibilité peuvent être modifiés pour préserver l'équité entre les
          membres. Les règles financières seront déverrouillées à la fin du cycle.
        </p>
      </div>
    );
  }
  if (w === "between_cycles") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
        <p className="text-foreground">
          <strong>Entre deux cycles.</strong> Toutes les règles sont modifiables ;
          les changements structurels (montant, fréquence, rotation, membres max.)
          seront <strong>notifiés à tous les membres</strong> et consignés comme
          consentement avant le prochain démarrage.
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm">
      <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
      <p className="text-foreground">
        <strong>Configuration libre.</strong> Le cycle n'a pas démarré : vous
        pouvez ajuster toutes les règles sans impact sur les membres.
      </p>
    </div>
  );
}