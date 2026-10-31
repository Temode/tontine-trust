import { cn } from "@/lib/utils";
import type { GroupStatus } from "@/lib/types";

const statusVisuals: Record<GroupStatus, { label: string; className: string; dotClassName: string }> = {
  active: {
    label: "Actif",
    className: "bg-success/10 text-success border-success/20",
    dotClassName: "bg-success",
  },
  "your-turn": {
    label: "Votre tour",
    className: "bg-accent-50 text-accent-700 border-accent-300",
    dotClassName: "bg-accent-600",
  },
  completed: {
    label: "Terminé",
    className: "bg-muted text-muted-foreground border-hairline",
    dotClassName: "bg-muted-foreground/60",
  },
  pending: {
    label: "Inscription",
    className: "bg-primary-50 text-primary border-primary-100",
    dotClassName: "bg-primary",
  },
};

interface StatusBadgeProps {
  status: GroupStatus;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({ status, size = "sm", className }: StatusBadgeProps) {
  const v = statusVisuals[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        v.className,
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", v.dotClassName)} />
      {v.label}
    </span>
  );
}
