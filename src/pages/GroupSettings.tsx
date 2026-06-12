import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Save, Lock } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { getGroup, updateGroupSettings, type UpdateGroupSettingsPayload } from "@/lib/api/groups";
import { useAuth } from "@/hooks/useAuth";

const FREQ_OPTIONS = [
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
  const locked = !!group && !(group.status === "draft" || group.status === "open");

  const [form, setForm] = useState<UpdateGroupSettingsPayload>({});

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

        {locked && (
          <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
            <Lock className="mt-0.5 h-4 w-4 text-warning" />
            <p className="text-foreground">
              <strong>Cycle déjà démarré.</strong> Les paramètres sont verrouillés
              pour préserver l'équité entre les membres.
            </p>
          </div>
        )}

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
            <Field label="Cotisation (GNF)">
              <input
                type="number"
                min={1000}
                step={1000}
                value={form.contribution_amount ?? 0}
                disabled={locked}
                onChange={(e) => update("contribution_amount", Number(e.target.value))}
                className={`${INPUT_CLASS} num`}
              />
            </Field>
            <Field label="Nombre de membres">
              <input
                type="number"
                min={2}
                max={100}
                value={form.max_members ?? 0}
                disabled={locked}
                onChange={(e) => update("max_members", Number(e.target.value))}
                className={`${INPUT_CLASS} num`}
              />
            </Field>
            <Field label="Fréquence">
              <select
                value={form.frequency ?? "mensuelle"}
                disabled={locked}
                onChange={(e) => update("frequency", e.target.value as UpdateGroupSettingsPayload["frequency"])}
                className={INPUT_CLASS}
              >
                {FREQ_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Ordre de rotation">
              <select
                value={form.rotation_order_kind ?? "random"}
                disabled={locked}
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
            <Field label="Pénalité (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={form.late_penalty_percent ?? 0}
                disabled={locked}
                onChange={(e) => update("late_penalty_percent", Number(e.target.value))}
                className={`${INPUT_CLASS} num`}
              />
            </Field>
            <Field label="Délai de grâce (jours)">
              <input
                type="number"
                min={0}
                value={form.late_penalty_after_days ?? 0}
                disabled={locked}
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
            onClick={() => saveM.mutate()}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saveM.isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}