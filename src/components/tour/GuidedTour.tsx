import { ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOUR_DONE_KEY, TOUR_STEPS, type TourStep } from "./steps";
import { TourContext } from "./useTour";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getRect(selector: string, padding = 6): Rect | null {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top - padding,
    left: r.left - padding,
    width: r.width + padding * 2,
    height: r.height + padding * 2,
  };
}

function computePopoverPos(
  rect: Rect,
  placement: TourStep["placement"] = "bottom",
  popW = 320,
  popH = 180,
  gap = 12,
): { top: number; left: number; placement: NonNullable<TourStep["placement"]> } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tryPlace = (p: NonNullable<TourStep["placement"]>) => {
    switch (p) {
      case "right":
        return { top: rect.top + rect.height / 2 - popH / 2, left: rect.left + rect.width + gap };
      case "left":
        return { top: rect.top + rect.height / 2 - popH / 2, left: rect.left - popW - gap };
      case "top":
        return { top: rect.top - popH - gap, left: rect.left + rect.width / 2 - popW / 2 };
      case "bottom":
      default:
        return { top: rect.top + rect.height + gap, left: rect.left + rect.width / 2 - popW / 2 };
    }
  };

  const fits = (pos: { top: number; left: number }) =>
    pos.top >= 8 && pos.left >= 8 && pos.top + popH <= vh - 8 && pos.left + popW <= vw - 8;

  const order: NonNullable<TourStep["placement"]>[] = [
    placement,
    "bottom",
    "top",
    "right",
    "left",
  ];
  for (const p of order) {
    const pos = tryPlace(p);
    if (fits(pos)) return { ...pos, placement: p };
  }
  // fallback: clamp bottom
  const pos = tryPlace("bottom");
  return {
    top: Math.max(8, Math.min(vh - popH - 8, pos.top)),
    left: Math.max(8, Math.min(vw - popW - 8, pos.left)),
    placement: "bottom",
  };
}

function TourOverlay({ onClose }: { onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [tick, setTick] = useState(0);

  // re-measure on resize/scroll
  useEffect(() => {
    const re = () => setTick((t) => t + 1);
    window.addEventListener("resize", re);
    window.addEventListener("scroll", re, true);
    const id = window.setInterval(re, 400); // catch DOM mutations cheaply
    return () => {
      window.removeEventListener("resize", re);
      window.removeEventListener("scroll", re, true);
      window.clearInterval(id);
    };
  }, []);

  const step = TOUR_STEPS[stepIndex];
  const rect = useMemo(
    () => (step ? getRect(step.selector, step.padding ?? 6) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, tick],
  );

  // scroll target into view when step changes
  useLayoutEffect(() => {
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [step]);

  const handleClose = useCallback(() => {
    try {
      localStorage.setItem(TOUR_DONE_KEY, "1");
    } catch {
      /* noop */
    }
    onClose();
  }, [onClose]);

  if (!step) {
    handleClose();
    return null;
  }

  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const isFirst = stepIndex === 0;

  const popW = 320;
  const popH = 200;
  const popPos = rect
    ? computePopoverPos(rect, step.placement, popW, popH)
    : { top: window.innerHeight / 2 - popH / 2, left: window.innerWidth / 2 - popW / 2, placement: "bottom" as const };

  const cutout = rect ?? { top: -1000, left: -1000, width: 0, height: 0 };

  return createPortal(
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      {/* SVG mask overlay with spotlight cutout */}
      <svg className="pointer-events-auto absolute inset-0 h-full w-full" onClick={handleClose}>
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={cutout.left}
              y={cutout.top}
              width={cutout.width}
              height={cutout.height}
              rx="12"
              ry="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(8, 28, 32, 0.65)"
          mask="url(#tour-mask)"
        />
        {/* Glowing ring around target */}
        {rect && (
          <rect
            x={cutout.left}
            y={cutout.top}
            width={cutout.width}
            height={cutout.height}
            rx="12"
            ry="12"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            className="animate-pulse"
            style={{ pointerEvents: "none" }}
          />
        )}
      </svg>

      {/* Popover card */}
      <div
        className={cn(
          "pointer-events-auto absolute rounded-xl border border-hairline bg-card shadow-2xl",
          "animate-fade-in",
        )}
        style={{ top: popPos.top, left: popPos.left, width: popW }}
      >
        <div className="flex items-start gap-3 p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-display text-sm font-bold">
            {stepIndex + 1}
          </div>
          <div className="min-w-0 flex-1">
            <h3
              id="tour-title"
              className="font-display text-base font-bold leading-tight text-foreground"
            >
              {step.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer la visite"
            className="text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-hairline px-5 py-3">
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === stepIndex ? "w-5 bg-primary" : "w-1.5 bg-border",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Précédent
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1))}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-primary transition hover:bg-primary-700"
              >
                Étape suivante
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-primary transition hover:bg-primary-700"
              >
                J'ai compris, c'est parti
              </button>
            )}
          </div>
        </div>

        {isFirst && (
          <button
            type="button"
            onClick={handleClose}
            className="absolute -bottom-7 left-0 text-[11px] font-medium text-muted-foreground/80 hover:text-foreground"
          >
            Passer la visite guidée
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function GuidedTourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);

  // Auto-start once per user (localStorage flag)
  useEffect(() => {
    try {
      const done = localStorage.getItem(TOUR_DONE_KEY);
      if (!done) {
        const t = window.setTimeout(() => setActive(true), 900);
        return () => window.clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      active,
      start: () => setActive(true),
      stop: () => setActive(false),
    }),
    [active],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && <TourOverlay onClose={() => setActive(false)} />}
    </TourContext.Provider>
  );
}