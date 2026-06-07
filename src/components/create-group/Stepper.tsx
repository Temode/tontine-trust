import { cn } from "@/lib/utils";
import { STEPS } from "./types";

interface StepperProps {
  current: number;
  onJump?: (step: number) => void;
  /** Steps already completed (so they can be jumped back to). */
  completed: number[];
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Stepper "Registre souverain" — grille 5 colonnes, séparateurs filets,
 * étape active = fond ivoire + sous-ligne sarcelle, étapes futures grisées 60 %.
 */
export function Stepper({ current, onJump, completed }: StepperProps) {
  return (
    <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3 lg:grid-cols-5">
      {STEPS.map((step) => {
        const isActive = step.id === current;
        const isDone = completed.includes(step.id) && !isActive;
        const interactive = isDone && Boolean(onJump);

        return (
          <li
            key={step.id}
            className={cn(
              "relative bg-card",
              isActive ? "border-b-2 border-primary" : "border-b-2 border-transparent",
              !isActive && !isDone && "opacity-60",
            )}
          >
            <button
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onJump?.(step.id)}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "block w-full px-5 py-4 text-left",
                interactive ? "cursor-pointer hover:bg-secondary/40" : "cursor-default",
              )}
            >
              <span
                className={cn(
                  "block text-[10px] font-bold uppercase tracking-[0.18em]",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                Étape {pad2(step.id)}
              </span>
              <span
                className={cn(
                  "mt-1 block truncate text-sm font-semibold",
                  isActive || isDone ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.title}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
