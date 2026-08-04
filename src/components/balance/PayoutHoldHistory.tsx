import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { listMyPayoutHoldHistory } from "@/lib/api/holdPayouts";
import { formatGNF } from "@/lib/format";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

interface Props {
  /** Si fourni, ne montre que l'historique de ce groupe. */
  groupId?: string;
}

export function PayoutHoldHistory({ groupId }: Props) {
  const q = useQuery({
    queryKey: ["my-hold-history", groupId ?? "all"],
    queryFn: listMyPayoutHoldHistory,
  });

  if (q.isLoading) return <div className="h-24 animate-pulse rounded-xl bg-secondary/50" />;
  const rows = (q.data ?? []).filter((r) => !groupId || r.group_id === groupId);
  if (rows.length === 0) return null;

  return (
    <section
      aria-label="Historique des rétentions"
      className="mt-5 rounded-xl border border-hairline bg-card p-4"
    >
      <header className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 text-amber-700">
          <History className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-display text-sm font-bold text-foreground">
            Historique des rétentions
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Mise en attente et date de libération de vos payouts
          </p>
        </div>
      </header>
      <ul className="divide-y divide-hairline">
        {rows.map((r) => (
          <li key={r.turn_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">
                {r.group_name ?? "Groupe"} — tour #{r.turn_number}
              </p>
              <p className="text-muted-foreground">
                Mise en attente : {r.paid_at ? fmt(r.paid_at) : "—"} → libération : {fmt(r.payout_hold_until)}
                {r.is_extended ? " (rétention majorée)" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="num font-semibold text-foreground">
                {formatGNF(r.payout_amount)} GNF
              </span>
              <span
                className={
                  r.is_released
                    ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                    : "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                }
              >
                {r.is_released ? "Libéré" : "En attente"}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}