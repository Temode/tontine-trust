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
        "inline-flex items-center gap-1.5 rounded-full border font-medium uppercase tracking-wider",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        v.className,
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", v.dotClassName)} />
      {v.label}
    </span>
  );
}
