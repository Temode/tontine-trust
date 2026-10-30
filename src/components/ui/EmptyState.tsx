import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: "primary" | "secondary";
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  className?: string;
}

/**
 * Empty state à la Paxefy : pastille colorée + titre + sous-titre + CTAs duals.
 * Réutilisable sur toutes les pages (Accueil, Mes tontines, Payer, Reçus…).
 */
export function EmptyState({ icon: Icon, title, description, actions, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-5 py-12 text-center lg:px-6", className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {actions && actions.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={a.onClick}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition",
                (a.variant ?? (i === 0 ? "primary" : "secondary")) === "primary"
                  ? "bg-primary text-primary-foreground shadow-primary hover:bg-primary-700"
                  : "border border-hairline bg-card text-foreground hover:bg-secondary",
              )}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}