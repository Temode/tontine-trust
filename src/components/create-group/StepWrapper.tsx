import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepWrapperProps {
  index: number;
  total: number;
  title: string;
  description: string;
  canContinue: boolean;
  /** Label of the forward CTA. Defaults to "Étape suivante". */
  continueLabel?: string;
  onBack?: () => void;
  onContinue?: () => void;
  /** Right-side actions when on the final step (instead of "Continuer"). */
  customActions?: ReactNode;
  children: ReactNode;
}

/**
 * Carte d'étape "Registre souverain" — pas d'ombre, bordures slate fines,
 * titre en serif Playfair, footer minimaliste sans bandeau secondaire.
 */
export function StepWrapper({
  title,
  description,
  canContinue,
  continueLabel = "Étape suivante",
  onBack,
  onContinue,
  customActions,
  children,
}: StepWrapperProps) {
  return (
    <article className="rounded-xl border border-border bg-card p-6 lg:p-10">
      <header className="mb-8 lg:mb-10">
        <h2 className="font-serif text-2xl font-bold text-foreground lg:text-3xl">{title}</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>
      </header>

      <div>{children}</div>

      <footer className="mt-10 flex items-center justify-between gap-3 border-t border-border pt-6 lg:pt-8">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          className={cn(
            "px-4 py-2 text-sm font-bold transition-colors",
            onBack ? "text-muted-foreground hover:text-foreground" : "cursor-not-allowed text-muted-foreground/40",
          )}
        >
          Retour
        </button>

        {customActions ? (
          customActions
        ) : (
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-8 py-3 text-sm font-bold transition-all",
              canContinue
                ? "bg-primary text-primary-foreground hover:bg-primary-700"
                : "cursor-not-allowed bg-muted text-muted-foreground",
            )}
          >
            {continueLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </footer>
    </article>
  );
}
