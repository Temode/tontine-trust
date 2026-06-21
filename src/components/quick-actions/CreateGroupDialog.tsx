import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, CheckCircle2, Loader2, PlusCircle, ShieldCheck, X } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import { createGroup } from "@/lib/api/groups";
import { DEFAULT_DRAFT, generateInviteCode, type GroupCategory } from "@/components/create-group/types";
import type { Frequency } from "@/lib/types";

const quickSchema = z.object({
  name: z.string().trim().min(3, "Le nom doit faire au moins 3 caractères.").max(64, "64 caractères max."),
  category: z.enum(["family", "professional", "business", "community"]),
  frequency: z.enum(["Hebdomadaire", "Quinzaine", "Mensuelle"]),
  contribution: z
    .number({ invalid_type_error: "Cotisation requise." })
    .int()
    .min(1000, "Minimum 1 000 GNF.")
    .max(50_000_000, "Maximum 50 000 000 GNF."),
  members: z.number({ invalid_type_error: "Nombre requis." }).int().min(2, "Au moins 2 membres.").max(50, "50 max."),
});

type QuickInput = z.infer<typeof quickSchema>;

const CATEGORIES: Array<{ id: GroupCategory; label: string; hint: string }> = [
  { id: "family", label: "Famille", hint: "Cercle proche" },
  { id: "professional", label: "Collègues", hint: "Bureau, équipe" },
  { id: "business", label: "Commerçants", hint: "Marché, atelier" },
  { id: "community", label: "Communauté", hint: "Quartier, association" },
];

const FREQUENCIES: Array<{ id: Frequency; label: string; sub: string }> = [
  { id: "Hebdomadaire", label: "Hebdo", sub: "7 j" },
  { id: "Quinzaine", label: "Quinzaine", sub: "14 j" },
  { id: "Mensuelle", label: "Mensuelle", sub: "30 j" },
];

export function CreateGroupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<QuickInput>({
    name: "",
    category: "family",
    frequency: "Mensuelle",
    contribution: 500_000,
    members: 12,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof QuickInput, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; code: string } | null>(null);

  const cagnotte = useMemo(() => form.contribution * form.members, [form.contribution, form.members]);

  const reset = () => {
    setForm({ name: "", category: "family", frequency: "Mensuelle", contribution: 500_000, members: 12 });
    setErrors({});
    setSubmitting(false);
    setSubmitError(null);
    setSuccess(null);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v && !submitting) reset();
    onOpenChange(v);
  };

  const update = <K extends keyof QuickInput>(k: K, v: QuickInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
    if (submitError) setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = quickSchema.safeParse(form);
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof QuickInput | undefined;
        if (k && !next[k]) next[k] = issue.message;
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const code = generateInviteCode();
      const result = await createGroup({
        ...DEFAULT_DRAFT,
        name: parsed.data.name,
        category: parsed.data.category,
        frequency: parsed.data.frequency,
        contribution: parsed.data.contribution,
        members: parsed.data.members,
        inviteCode: code,
      });
      setSuccess({ id: result.group.id, code: result.inviteCode });
      toast.success("Tontine créée", { description: parsed.data.name });
      await queryClient.invalidateQueries({ queryKey: ["groups", "mine"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue lors de la création.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        {success ? (
          <SuccessView
            groupId={success.id}
            inviteCode={success.code}
            onClose={() => handleOpenChange(false)}
            onNavigate={() => {
              handleOpenChange(false);
              navigate(`/groupes/${success.id}`);
            }}
            onInvite={() => {
              handleOpenChange(false);
              navigate(`/inviter?group=${success.id}`);
            }}
          />
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader className="border-b border-hairline px-6 pb-4 pt-6 text-left">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                <PlusCircle className="h-3 w-3" />
                Création rapide
              </span>
              <DialogTitle className="mt-2 font-display text-2xl font-bold tracking-tight">
                Nouvelle tontine
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Les essentiels. Les règles avancées sont préréglées et modifiables ensuite.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 px-6 py-5">
              <Field label="Nom du groupe" error={errors.name}>
                <input
                  type="text"
                  autoFocus
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Ex. Famille Diallo · Cycle 2026"
                  maxLength={64}
                  className="h-10 w-full rounded-lg border border-hairline bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                />
              </Field>

              <Field label="Catégorie">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CATEGORIES.map((c) => {
                    const active = form.category === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => update("category", c.id)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-xs transition",
                          active
                            ? "border-primary bg-primary/[0.06] text-foreground"
                            : "border-hairline bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        )}
                      >
                        <p className="font-semibold text-foreground">{c.label}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{c.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Cotisation (GNF)" error={errors.contribution}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1000}
                    step={1000}
                    value={Number.isFinite(form.contribution) ? form.contribution : ""}
                    onChange={(e) => update("contribution", Number(e.target.value))}
                    className="h-10 w-full rounded-lg border border-hairline bg-card px-3 text-sm font-medium text-foreground num focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  />
                </Field>
                <Field label="Membres" error={errors.members}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={50}
                    value={Number.isFinite(form.members) ? form.members : ""}
                    onChange={(e) => update("members", Number(e.target.value))}
                    className="h-10 w-full rounded-lg border border-hairline bg-card px-3 text-sm font-medium text-foreground num focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  />
                </Field>
              </div>

              <Field label="Fréquence">
                <div className="grid grid-cols-3 gap-2">
                  {FREQUENCIES.map((f) => {
                    const active = form.frequency === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => update("frequency", f.id)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-center text-xs transition",
                          active
                            ? "border-primary bg-primary/[0.06] text-foreground"
                            : "border-hairline bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        )}
                      >
                        <p className="font-semibold text-foreground">{f.label}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{f.sub}</p>
                      </button>
                    );
                  })}
                </div>
              </Field>

              {/* Cagnotte preview */}
              <div className="flex items-center justify-between rounded-xl border border-hairline bg-secondary/40 px-4 py-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Cagnotte par tour
                  </p>
                  <p className="mt-1 font-display text-lg font-bold text-foreground num">
                    {formatGNF(cagnotte)} <span className="text-xs font-semibold text-muted-foreground">GNF</span>
                  </p>
                </div>
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>

              {submitError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/[0.05] px-3 py-2 text-xs text-destructive">
                  {submitError}
                </div>
              )}
            </div>

            <footer className="flex flex-col-reverse items-stretch gap-2 border-t border-hairline bg-card/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  handleOpenChange(false);
                  navigate("/nouveau");
                }}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              >
                Mode expert (assistant 5 étapes)
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="inline-flex h-10 items-center rounded-lg border border-hairline bg-card px-4 text-sm font-medium text-foreground transition hover:bg-secondary"
                  disabled={submitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                  Créer la tontine
                </button>
              </div>
            </footer>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SuccessView({
  groupId,
  inviteCode,
  onClose,
  onNavigate,
  onInvite,
}: {
  groupId: string;
  inviteCode: string;
  onClose: () => void;
  onNavigate: () => void;
  onInvite: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="px-6 pb-6 pt-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-display text-xl font-bold text-foreground">
          Tontine créée avec succès.
        </h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Partagez le code d'invitation à vos membres pour démarrer le cycle.
        </p>
        <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-lg border border-hairline bg-secondary/40 px-4 py-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Code</span>
          <span className="font-display text-base font-bold tracking-wider text-foreground">{inviteCode}</span>
        </div>
        <div className="mt-6 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onInvite}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-hairline bg-card px-4 text-sm font-medium text-foreground transition hover:bg-secondary"
          >
            Inviter des membres
          </button>
          <button
            type="button"
            onClick={onNavigate}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-700"
          >
            Voir la tontine
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">ID : {groupId.slice(0, 8)}…</p>
      </div>
    </div>
  );
}