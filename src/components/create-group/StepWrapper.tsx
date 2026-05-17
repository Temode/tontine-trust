import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepWrapperProps {
  index: number;
  total: number;
  title: string;
  description: string;
  canContinue: boolean;
  /** Label of the forward CTA. Defaults to "Continuer". */
  continueLabel?: string;
  onBack?: () => void;
  onContinue?: () => void;
  /** Right-side actions when on the final step (instead of "Continuer"). */
  customActions?: ReactNode;
  children: ReactNode;
}

export function StepWrapper({
  index,
  total,
  title,
  description,
  canContinue,
  continueLabel = "Continuer",
  onBack,
  onContinue,
  customActions,
  children,
}: StepWrapperProps) {
  return (
    <article className="rounded-xl border border-hairline bg-card">
      <header className="border-b border-hairline px-5 py-5 lg:px-7 lg:py-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          Étape {index} <span className="text-muted-foreground">/ {total}</span>
        </p>
        <h2 className="mt-1 font-display text-xl font-bold text-foreground lg:text-2xl">{title}</h2>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">{description}</p>
      </header>

      <div className="px-5 py-6 lg:px-7 lg:py-7">{children}</div>

      <footer className="flex items-center justify-between gap-3 border-t border-hairline bg-secondary/30 px-5 py-4 lg:px-7">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-md border border-hairline px-4 text-sm font-medium transition",
            onBack ? "text-foreground hover:bg-secondary" : "text-muted-foreground/50",
          )}
        >
          <ArrowLeft className="h-4 w-4" />
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
              "inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition",
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
