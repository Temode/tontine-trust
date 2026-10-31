import { cn } from "@/lib/utils";
import type { PresenceStatus } from "@/lib/api/presence";

const COLORS: Record<PresenceStatus | "offline", string> = {
  available: "bg-emerald-500",
  busy: "bg-amber-500",
  dnd: "bg-destructive",
  offline: "bg-muted-foreground/40",
};

const LABELS: Record<PresenceStatus | "offline", string> = {
  available: "Disponible",
  busy: "Occupé",
  dnd: "Ne pas déranger",
  offline: "Hors ligne",
};

interface Props {
  status: PresenceStatus | "offline";
  className?: string;
  showLabel?: boolean;
}

export function PresenceDot({ status, className, showLabel }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-label={LABELS[status]}
        title={LABELS[status]}
        className={cn(
          "h-2 w-2 rounded-full ring-2 ring-card",
          COLORS[status],
          className,
        )}
      />
      {showLabel && <span className="text-xs text-muted-foreground">{LABELS[status]}</span>}
    </span>
  );
}