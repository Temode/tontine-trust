import { cn } from "@/lib/utils";
import { TIER_CLASSES, TIER_LABEL, type ReliabilityTier } from "@/lib/api/reliability";

interface Props {
  score: number;
  tier: ReliabilityTier;
  compact?: boolean;
  className?: string;
}

export function ReliabilityBadge({ score, tier, compact, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        TIER_CLASSES[tier],
        className,
      )}
      title={`Fiabilité : ${TIER_LABEL[tier]} (${score}/100)`}
    >
      <span className="num">{score}</span>
      {!compact && <span>{TIER_LABEL[tier]}</span>}
    </span>
  );
}