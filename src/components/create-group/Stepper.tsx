import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEPS } from "./types";

interface StepperProps {
  current: number;
  onJump?: (step: number) => void;
  /** Steps already completed (so they can be jumped back to). */
  completed: number[];
}

export function Stepper({ current, onJump, completed }: StepperProps) {
  return (
    <ol className="flex items-stretch gap-0 overflow-x-auto rounded-xl border border-hairline bg-card scrollbar-thin">
      {STEPS.map((step, index) => {
        const isActive = step.id === current;
        const isDone = completed.includes(step.id) && !isActive;
        const isUpcoming = !isActive && !isDone;
        const interactive = isDone && Boolean(onJump);

        return (
          <li
            key={step.id}
            className={cn(
              "relative flex min-w-[180px] flex-1 items-center gap-3 px-5 py-4 lg:px-6",
              index > 0 && "border-l border-hairline",
              isActive && "bg-primary-50/40",
            )}
          >
            <button
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onJump?.(step.id)}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "flex w-full items-center gap-3 text-left",
                interactive && "cursor-pointer",
                !interactive && !isActive && "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
                  isActive && "border-primary bg-primary text-primary-foreground",
                  isDone && "border-success/40 bg-success/10 text-success",
                  isUpcoming && "border-hairline bg-card text-muted-foreground",
                )}
              >
                {isDone ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <span className="num">{step.id}</span>}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-[0.16em]",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  Étape {step.id}/{STEPS.length}
                </p>
                <p
                  className={cn(
                    "mt-0.5 truncate text-sm font-semibold",
                    isActive ? "text-foreground" : isDone ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.title}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{step.subtitle}</p>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
