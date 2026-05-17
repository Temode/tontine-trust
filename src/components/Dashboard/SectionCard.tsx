import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick?: () => void; href?: string };
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  bare?: boolean;
}

export function SectionCard({ title, subtitle, action, rightSlot, children, className, contentClassName, bare }: SectionCardProps) {
  return (
    <section className={cn("rounded-xl border border-hairline bg-card", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 lg:px-6 lg:py-5">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-foreground lg:text-lg">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {rightSlot}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:text-primary-700 lg:text-sm"
            >
              {action.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>
      <div className={cn(!bare && "p-5 lg:p-6", contentClassName)}>{children}</div>
    </section>
  );
}
