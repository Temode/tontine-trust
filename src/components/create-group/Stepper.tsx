import { useRef } from "react";
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
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusStep = (idx: number) => {
    const target = refs.current[idx];
    if (target && !target.disabled) target.focus();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(STEPS.length - 1, idx + 1);
      focusStep(next);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(0, idx - 1);
      focusStep(prev);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusStep(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusStep(STEPS.length - 1);
    }
  };

  return (
    <ol
      role="list"
      aria-label="Étapes de création du groupe"
      className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3 lg:grid-cols-5"
    >
      {STEPS.map((step) => {
        const isActive = step.id === current;
        const isDone = completed.includes(step.id) && !isActive;
        const interactive = isDone && Boolean(onJump);
        const idx = step.id - 1;

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
              ref={(el) => (refs.current[idx] = el)}
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onJump?.(step.id)}
              onKeyDown={(e) => handleKey(e, idx)}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "block w-full px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
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
