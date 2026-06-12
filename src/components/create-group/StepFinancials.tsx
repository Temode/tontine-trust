import { Calendar, Coins, Minus, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGNF } from "@/lib/format";
import type { Frequency } from "@/lib/types";
import { deriveFromDraft, type GroupDraft } from "./types";
import { StepWrapper } from "./StepWrapper";

interface StepFinancialsProps {
  draft: GroupDraft;
  onChange: (patch: Partial<GroupDraft>) => void;
  onBack?: () => void;
  onContinue?: () => void;
  index: number;
  total: number;
}

const QUICK_AMOUNTS = [100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

const FREQUENCIES: Array<{ id: Frequency; label: string; cadence: string }> = [
  { id: "Hebdomadaire", label: "Hebdomadaire", cadence: "Tous les 7 jours" },
  { id: "Quinzaine", label: "Quinzaine", cadence: "Tous les 14 jours" },
  { id: "Mensuelle", label: "Mensuelle", cadence: "Tous les 30 jours" },
];

function parseNonNegativeInt(raw: string, max = 1_000_000_000): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d]/g, "").slice(0, 12);
  const n = parseInt(cleaned, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, n);
}

export function StepFinancials({ draft, onChange, onBack, onContinue, index, total }: StepFinancialsProps) {
  const derived = deriveFromDraft(draft);
  const canContinue = draft.contribution >= 10_000 && draft.members >= 3 && draft.members <= 50;

  const adjustMembers = (delta: number) => {
    const next = Math.max(3, Math.min(50, draft.members + delta));
    onChange({ members: next });
  };

  return (
    <StepWrapper
      index={index}
      total={total}
      title="Paramètres financiers"
      description="Définissez la cotisation, la fréquence et la taille du groupe. Ces termes structurent toute la mécanique du cycle."
      canContinue={canContinue}
      onBack={onBack}
      onContinue={onContinue}
    >
      <div className="space-y-7">
        {/* Cotisation */}
        <section>
          <SectionHeader icon={<Coins className="h-4 w-4" />} title="Cotisation par tour" hint="Montant prélevé à chaque échéance auprès de chaque membre." />

          <div className="mt-3 flex items-stretch gap-2">
            <div className="relative flex-1">
              <input
                aria-label="Montant de la cotisation"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={draft.contribution ? draft.contribution.toLocaleString("fr-FR") : ""}
                onChange={(e) => onChange({ contribution: parseNonNegativeInt(e.target.value) })}
                className="h-12 w-full rounded-md border border-border bg-card px-4 pr-16 font-display text-xl font-bold text-foreground num transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                GNF
              </span>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {QUICK_AMOUNTS.map((amount) => {
              const active = draft.contribution === amount;
              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() => onChange({ contribution: amount })}
                  aria-pressed={active}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-semibold transition num",
                    active ? "border-primary bg-primary-50 text-primary" : "border-border text-muted-foreground hover:border-muted-foreground/30",
                  )}
                >
                  {formatGNF(amount, { compact: amount >= 1_000_000 })} GNF
                </button>
              );
            })}
          </div>
        </section>

        {/* Fréquence */}
        <section>
          <SectionHeader icon={<Calendar className="h-4 w-4" />} title="Fréquence" hint="Plus la fréquence est courte, plus le cycle se boucle vite." />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {FREQUENCIES.map((f) => {
              const active = draft.frequency === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onChange({ frequency: f.id })}
                  aria-pressed={active}
                  className={cn(
                    "rounded-lg p-5 text-left transition-all",
                    active
                      ? "border-2 border-primary bg-primary-50/40"
                      : "border border-border hover:border-muted-foreground/30",
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">{f.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{f.cadence}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Nombre de membres */}
        <section>
          <SectionHeader icon={<Users className="h-4 w-4" />} title="Nombre de membres" hint="Entre 3 et 50. Définit la taille du cycle et la cagnotte par tour." />

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => adjustMembers(-1)}
              aria-label="Retirer un membre"
              className="flex h-11 w-11 items-center justify-center rounded-md border border-border text-foreground transition hover:bg-secondary"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              aria-label="Nombre de membres"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.members || ""}
              onChange={(e) => {
                const n = parseNonNegativeInt(e.target.value, 50);
                onChange({ members: n });
              }}
              onBlur={(e) => {
                const n = parseNonNegativeInt(e.target.value, 50);
                onChange({ members: Math.max(3, Math.min(50, n || 3)) });
              }}
              className="h-11 w-24 rounded-md border border-border bg-card px-3 text-center font-display text-lg font-bold text-foreground num transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => adjustMembers(1)}
              aria-label="Ajouter un membre"
              className="flex h-11 w-11 items-center justify-center rounded-md border border-border text-foreground transition hover:bg-secondary"
            >
              <Plus className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={3}
              max={50}
              value={draft.members}
              onChange={(e) => onChange({ members: Number(e.target.value) })}
              aria-label="Curseur du nombre de membres"
              className="ml-2 hidden flex-1 accent-primary sm:block"
            />
          </div>
        </section>

        {/* Live derived metrics */}
        <section className="rounded-lg border border-border bg-secondary/40 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Calculé à partir de vos paramètres
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric
              label="Cagnotte / tour"
              value={
                <>
                  <span className="num text-accent-700">{formatGNF(derived.cagnotte, { compact: derived.cagnotte >= 1_000_000 })}</span>
                  <span className="ml-1 text-[11px] text-muted-foreground">GNF</span>
                </>
              }
            />
            <Metric label="Durée du cycle" value={derived.cycleLabel} />
            <Metric label="Encaissement le + tôt" value={derived.yourTurnEarliestLabel} mute />
            <Metric label="Encaissement le + tard" value={derived.yourTurnLatestLabel} mute />
          </dl>
        </section>
      </div>
    </StepWrapper>
  );
}

function SectionHeader({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <header>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-primary">{icon}</span>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </header>
  );
}

function Metric({ label, value, mute }: { label: string; value: React.ReactNode; mute?: boolean }) {
  return (
    <div className="rounded-md bg-card px-3 py-2.5">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 font-display text-sm font-bold", mute ? "text-muted-foreground" : "text-foreground")}>
        {value}
      </dd>
    </div>
  );
}
