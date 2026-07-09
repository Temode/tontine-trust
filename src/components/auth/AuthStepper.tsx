import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AuthStep {
  label: string;
}

interface AuthStepperProps {
  steps: AuthStep[];
  /** Index de l'étape courante (0-based). */
  current: number;
  className?: string;
}

/**
 * Stepper horizontal (Stripe/Linear-like) pour matérialiser l'avancement
 * dans les parcours multi-étapes de /auth (vérification email,
 * réinitialisation mot de passe).
 */
export function AuthStepper({ steps, current, className }: AuthStepperProps) {
  return (
    <ol
      className={cn("flex w-full items-center gap-2", className)}
      aria-label="Progression"
    >
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step.label} className="flex flex-1 items-center gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-white text-primary",
                  !done && !active && "border-foreground/15 bg-white text-foreground/40",
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "truncate text-[11px] font-semibold uppercase tracking-[0.14em]",
                  active && "text-foreground",
                  done && "text-foreground/70",
                  !done && !active && "text-foreground/35",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "h-px flex-1 transition-colors",
                  done ? "bg-primary/60" : "bg-foreground/10",
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
