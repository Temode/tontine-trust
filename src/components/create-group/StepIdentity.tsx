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
      description="Donnez à votre tontine une identité claire. Le nom apparaîtra sur les reçus, les notifications et le registre."
      canContinue={canContinue}
      onBack={onBack}
      onContinue={onContinue}
    >
      <div className="space-y-6">
        <Field
          id="cg-name"
          label="Nom du groupe"
          hint="Visible par tous les membres et imprimé sur les reçus."
        >
          <input
            id="cg-name"
            type="text"
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Ex. Tontine Famille Diallo"
            maxLength={64}
            className="h-11 w-full rounded-md border border-hairline bg-card px-3 text-base font-medium text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground num">
            {draft.name.length}/64 caractères {draft.name.trim().length < 3 && draft.name.length > 0 && "· minimum 3"}
          </p>
        </Field>

        <Field
          id="cg-description"
          label="Description (facultatif)"
          hint="Une phrase courte qui explique l'objet du groupe à vos futurs membres."
        >
          <textarea
            id="cg-description"
            value={draft.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Ex. Tontine mensuelle pour financer les projets familiaux et les imprévus."
            rows={3}
            maxLength={280}
            className="w-full rounded-md border border-hairline bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground num">{draft.description.length}/280</p>
        </Field>

        <fieldset>
          <legend className="text-sm font-semibold text-foreground">Catégorie</legend>
          <p className="mt-1 text-xs text-muted-foreground">
            Aide à classer votre groupe et à proposer des règles par défaut adaptées.
          </p>

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
                    "flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition",
                    active ? "border-primary bg-primary-50/40 ring-1 ring-primary/20" : "border-hairline hover:bg-secondary/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                      active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{CATEGORY_LABEL[cat.id]}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{cat.description}</p>
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
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}
