import { ArrowRightLeft, ClipboardList, ShieldAlert, Shuffle, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { type GroupDraft, type RotationOrder, type SwapPolicy } from "./types";
import { StepWrapper } from "./StepWrapper";

interface StepRulesProps {
  draft: GroupDraft;
  onChange: (patch: Partial<GroupDraft>) => void;
  onBack?: () => void;
  onContinue?: () => void;
  index: number;
  total: number;
}

const ROTATION_OPTIONS: Array<{
  id: RotationOrder;
  icon: LucideIcon;
  label: string;
  description: string;
}> = [
  {
    id: "random",
    icon: Shuffle,
    label: "Tirage au sort",
    description: "L'ordre des bénéficiaires est tiré aléatoirement à l'émission. Équitable par défaut.",
  },
  {
    id: "fixed",
    icon: ClipboardList,
    label: "Ordre fixe",
    description: "L'ordre est défini manuellement par l'organisateur, généralement par ancienneté.",
  },
  {
    id: "auction",
    icon: ArrowRightLeft,
    label: "Enchères",
    description: "À chaque tour, les membres enchérissent une décote pour avancer leur position.",
  },
  {
    id: "choice",
    icon: Users,
    label: "Choix individuel",
    description: "Chaque membre choisit son tour à l'inscription, sous réserve de disponibilité.",
  },
];

const SWAP_OPTIONS: Array<{
  id: SwapPolicy;
  label: string;
  description: string;
}> = [
  { id: "open", label: "Échanges libres", description: "Deux membres peuvent échanger leur tour sans validation." },
  { id: "consensus", label: "Sur consensus", description: "L'échange requiert l'accord d'une majorité du groupe." },
  { id: "closed", label: "Interdits", description: "L'ordre de rotation est figé jusqu'à la fin du cycle." },
];

const PENALTY_PRESETS = [0, 5, 10, 15];

export function StepRules({ draft, onChange, onBack, onContinue, index, total }: StepRulesProps) {
  return (
    <StepWrapper
      index={index}
      total={total}
      title="Règles et conformité"
      description="Cadrez la gouvernance du groupe : ordre de rotation, traitement des retards, politique d'échange."
      canContinue={true}
      onBack={onBack}
      onContinue={onContinue}
    >
      <div className="space-y-7">
        <section>
          <Header title="Ordre de rotation" hint="Comment l'ordre des bénéficiaires est-il déterminé ?" />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ROTATION_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = draft.rotationOrder === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChange({ rotationOrder: opt.id })}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-col rounded-lg p-5 text-left transition-all",
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
                    <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <Header title="Pénalité de retard" hint="Pourcentage prélevé en plus de la cotisation après expiration du délai de grâce." />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="cg-penalty" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Pourcentage
              </label>
              <div className="mt-1.5 flex items-stretch">
                <input
                  id="cg-penalty"
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  value={draft.latePenaltyPercent}
                  onChange={(e) => onChange({ latePenaltyPercent: Math.max(0, Math.min(50, Number(e.target.value))) })}
                  className="h-11 w-full rounded-l-md border border-r-0 border-border bg-card px-3 text-base font-semibold text-foreground num focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="inline-flex h-11 items-center rounded-r-md border border-border bg-secondary px-3 text-sm font-semibold text-muted-foreground">
                  %
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PENALTY_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onChange({ latePenaltyPercent: p })}
                    aria-pressed={draft.latePenaltyPercent === p}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-semibold transition num",
                      draft.latePenaltyPercent === p
                        ? "border-primary bg-primary-50 text-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground/30",
                    )}
                  >
                    {p === 0 ? "Aucune" : `${p}%`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="cg-grace" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Délai de grâce
              </label>
              <div className="mt-1.5 flex items-stretch">
                <input
                  id="cg-grace"
                  type="number"
                  min={0}
                  max={14}
                  step={1}
                  value={draft.latePenaltyAfterDays}
                  onChange={(e) => onChange({ latePenaltyAfterDays: Math.max(0, Math.min(14, Number(e.target.value))) })}
                  className="h-11 w-full rounded-l-md border border-r-0 border-border bg-card px-3 text-base font-semibold text-foreground num focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="inline-flex h-11 items-center rounded-r-md border border-border bg-secondary px-3 text-sm font-semibold text-muted-foreground">
                  jours
                </span>
              </div>
              <p className="mt-2 inline-flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <ShieldAlert className="mt-0.5 h-3 w-3 text-warning" />
                <span>
                  La pénalité s'applique après {draft.latePenaltyAfterDays} {draft.latePenaltyAfterDays > 1 ? "jours" : "jour"} de retard.
                </span>
              </p>
            </div>
          </div>
        </section>

        <section>
          <Header title="Politique d'échange de tours" hint="Cadre dans lequel deux membres peuvent permuter leur position." />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SWAP_OPTIONS.map((opt) => {
              const active = draft.swapPolicy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChange({ swapPolicy: opt.id })}
                  aria-pressed={active}
                  className={cn(
                    "rounded-lg p-5 text-left transition-all",
                    active
                      ? "border-2 border-primary bg-primary-50/40"
                      : "border border-border hover:border-muted-foreground/30",
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </StepWrapper>
  );
}

function Header({ title, hint }: { title: string; hint: string }) {
  return (
    <header>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </header>
  );
}
