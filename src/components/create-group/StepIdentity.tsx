import { Briefcase, Building2, Heart, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, type GroupCategory, type GroupDraft } from "./types";
import { StepWrapper } from "./StepWrapper";

interface StepIdentityProps {
  draft: GroupDraft;
  onChange: (patch: Partial<GroupDraft>) => void;
  onBack?: () => void;
  onContinue?: () => void;
  index: number;
  total: number;
}

const CATEGORIES: Array<{
  id: GroupCategory;
  icon: LucideIcon;
  description: string;
}> = [
  { id: "family", icon: Heart, description: "Cercle familial proche, parents, fratrie." },
  { id: "professional", icon: Briefcase, description: "Collègues d'une même entreprise ou administration." },
  { id: "business", icon: Building2, description: "Commerçants, marchés, secteur informel structuré." },
  { id: "community", icon: Users, description: "Quartier, association, communauté élargie." },
];

export function StepIdentity({ draft, onChange, onBack, onContinue, index, total }: StepIdentityProps) {
  const canContinue = draft.name.trim().length >= 3;

  return (
    <StepWrapper
      index={index}
      total={total}
      title="Identité du groupe"
      description="Définissez le cadre institutionnel de votre tontine. Ces informations figureront sur l'ensemble des registres officiels."
      canContinue={canContinue}
      onBack={onBack}
      onContinue={onContinue}
    >
      <div className="space-y-6">
        <Field
          id="cg-name"
          label="Nom du groupe"
        >
          <input
            id="cg-name"
            type="text"
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Ex. Tontine Famille Diallo"
            maxLength={64}
            className="w-full rounded-md border border-border bg-card px-4 py-3 text-base font-medium text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="mt-1.5 text-right text-[11px] text-muted-foreground num">
            {draft.name.length}/64 caractères {draft.name.trim().length < 3 && draft.name.length > 0 && "· minimum 3"}
          </p>
        </Field>

        <Field
          id="cg-description"
          label="Description (Objet social)"
        >
          <textarea
            id="cg-description"
            value={draft.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Définissez l'objet social de votre groupe…"
            rows={3}
            maxLength={280}
            className="w-full resize-none rounded-md border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="mt-1.5 text-right text-[11px] text-muted-foreground num">{draft.description.length}/280</p>
        </Field>

        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Secteur d'activité</legend>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const active = draft.category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onChange({ category: cat.id })}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-col rounded-lg border p-5 text-left transition-all",
                    active
                      ? "border-2 border-primary bg-primary-50/40"
                      : "border border-border hover:border-muted-foreground/30",
                  )}
                >
                  <span
                    className={cn(
                      "mb-3 flex h-8 w-8 items-center justify-center rounded-full",
                      active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{CATEGORY_LABEL[cat.id]}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{cat.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </StepWrapper>
  );
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}

function Field({ id, label, hint, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div>{children}</div>
    </div>
  );
}
