import { useQuery } from "@tanstack/react-query";
import { Hash, Lock, ShieldCheck } from "lucide-react";
import { getMemberPositionInfo } from "@/lib/api/deposits";

interface PositionBadgeProps {
  groupId: string;
  userId: string;
}

/**
 * Affiche le rang du membre et l'état du verrou caution / dernier tiers.
 * Lecture de get_member_position_info (RPC).
 */
export function PositionBadge({ groupId, userId }: PositionBadgeProps) {
  const q = useQuery({
    queryKey: ["member-position", groupId, userId],
    queryFn: () => getMemberPositionInfo(groupId, userId),
    enabled: !!groupId && !!userId,
    staleTime: 30_000,
  });
  const info = q.data;
  if (!info || info.member_position == null) return null;

  return (
    <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
      <span className="inline-flex items-center gap-1 font-semibold text-foreground">
        <Hash className="h-3.5 w-3.5 text-primary" />
        Position {info.member_position}
        <span className="text-muted-foreground">/ {info.total_active}</span>
      </span>
      {info.is_in_last_third && (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
          Dernier tiers
        </span>
      )}
      {info.joined_after_start && (
        <span className="rounded-md bg-secondary px-2 py-0.5 text-muted-foreground">
          Rejoint après démarrage
        </span>
      )}
      {info.withdrawal_locked ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">
          <Lock className="h-3 w-3" />
          Retrait verrouillé — caution requise
        </span>
      ) : info.deposit_required && info.deposit_status === "paid" ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
          <ShieldCheck className="h-3 w-3" />
          Caution validée
        </span>
      ) : null}
    </div>
  );
}