import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gavel, Trophy, X } from "lucide-react";
import {
  closeAuction,
  listGroupBids,
  placeBid,
  cancelMyBid,
  subscribeGroupBids,
  type DbTurnBid,
} from "@/lib/api/auctions";
import { listGroupTurns } from "@/lib/api/turns";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { formatGNF } from "@/lib/format";

export function AuctionPanel({
  groupId,
  currentUserId,
  isOrganizer,
}: {
  groupId: string;
  currentUserId: string | null;
  isOrganizer: boolean;
}) {
  const qc = useQueryClient();

  const turnsQ = useQuery({
    queryKey: ["group", groupId, "turns"],
    queryFn: () => listGroupTurns(groupId),
  });
  const bidsQ = useQuery({
    queryKey: ["group", groupId, "bids"],
    queryFn: () => listGroupBids(groupId),
  });

  useEffect(() => {
    return subscribeGroupBids(groupId, () => {
      qc.invalidateQueries({ queryKey: ["group", groupId, "bids"] });
      qc.invalidateQueries({ queryKey: ["group", groupId, "turns"] });
    });
  }, [groupId, qc]);

  const upcomingTurns = useMemo(
    () => (turnsQ.data ?? []).filter((t) => t.status === "upcoming"),
    [turnsQ.data],
  );

  const bidsByTurn = useMemo(() => {
    const m = new Map<string, DbTurnBid[]>();
    for (const b of bidsQ.data ?? []) {
      const arr = m.get(b.turn_id) ?? [];
      arr.push(b);
      m.set(b.turn_id, arr);
    }
    return m;
  }, [bidsQ.data]);

  const placeM = useMutation({
    mutationFn: (v: { turnId: string; amount: number }) => placeBid(v.turnId, v.amount),
    onSuccess: () => {
      toast.success("Enchère enregistrée");
      qc.invalidateQueries({ queryKey: ["group", groupId, "bids"] });
    },
    onError: (e: Error) => toast.error("Enchère refusée", { description: e.message }),
  });
  const cancelM = useMutation({
    mutationFn: (turnId: string) => cancelMyBid(turnId),
    onSuccess: () => {
      toast.success("Enchère annulée");
      qc.invalidateQueries({ queryKey: ["group", groupId, "bids"] });
    },
    onError: (e: Error) => toast.error("Annulation impossible", { description: e.message }),
  });
  const closeM = useMutation({
    mutationFn: (turnId: string) => closeAuction(turnId),
    onSuccess: () => {
      toast.success("Enchère clôturée");
      qc.invalidateQueries({ queryKey: ["group", groupId] });
    },
    onError: (e: Error) => toast.error("Clôture impossible", { description: e.message }),
  });

  if (turnsQ.isLoading) {
    return <SectionCard title="Enchères"><p className="text-sm text-muted-foreground">Chargement…</p></SectionCard>;
  }
  if (upcomingTurns.length === 0) {
    return (
      <SectionCard title="Enchères" subtitle="Aucun tour à venir">
        <p className="text-sm text-muted-foreground">
          Aucun tour ouvert aux enchères pour le moment.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {upcomingTurns.map((t) => {
        const bids = (bidsByTurn.get(t.turn_id) ?? [])
          .filter((b) => b.status === "active")
          .sort((a, b) => b.amount - a.amount);
        const top = bids[0];
        const myBid = bids.find((b) => b.bidder_user_id === currentUserId) ?? null;
        const isMyTurn = t.beneficiary_user_id === currentUserId;
        return (
          <SectionCard
            key={t.turn_id}
            title={`Tour #${t.turn_number} — ${new Date(t.due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`}
            subtitle={`Bénéficiaire actuel : ${t.beneficiary_name ?? "—"} · cagnotte ${formatGNF(t.payout_amount)}`}
          >
            <div className="space-y-4">
              <div className="rounded-lg border border-hairline bg-secondary/30 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Meilleure enchère</p>
                  <p className="font-display text-lg font-bold text-foreground num">
                    {top ? formatGNF(top.amount) : "—"}
                  </p>
                </div>
                {top && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    par {top.bidder_name ?? "Membre"}
                  </p>
                )}
              </div>

              {bids.length > 0 && (
                <ul className="space-y-1.5">
                  {bids.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between rounded-md border border-hairline px-3 py-2 text-sm"
                    >
                      <span className="text-foreground">{b.bidder_name ?? "Membre"}</span>
                      <span className="font-display font-bold text-foreground num">
                        {formatGNF(b.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {!isMyTurn && currentUserId && (
                <BidForm
                  minAmount={(top?.amount ?? 0) + 1}
                  onSubmit={(amount) => placeM.mutate({ turnId: t.turn_id, amount })}
                  pending={placeM.isPending}
                  hasActiveBid={!!myBid}
                  onCancel={() => cancelM.mutate(t.turn_id)}
                  canceling={cancelM.isPending}
                />
              )}

              {isOrganizer && bids.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Clôturer l'enchère du tour #${t.turn_number} ? Le gagnant prendra ce tour, sa prime de ${formatGNF(top!.amount)} sera redistribuée.`)) {
                      closeM.mutate(t.turn_id);
                    }
                  }}
                  disabled={closeM.isPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-60"
                >
                  <Trophy className="h-4 w-4" />
                  Clôturer l'enchère
                </button>
              )}
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}

function BidForm({
  minAmount,
  onSubmit,
  pending,
  hasActiveBid,
  onCancel,
  canceling,
}: {
  minAmount: number;
  onSubmit: (amount: number) => void;
  pending: boolean;
  hasActiveBid: boolean;
  onCancel: () => void;
  canceling: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value);
        if (!Number.isFinite(n) || n < minAmount) {
          toast.error(`Montant minimum : ${minAmount} GNF`);
          return;
        }
        onSubmit(Math.floor(n));
        setValue("");
      }}
      className="flex flex-col gap-2 sm:flex-row"
    >
      <input
        type="number"
        min={minAmount}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`≥ ${minAmount} GNF`}
        className="flex-1 rounded-md border border-hairline bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-accent-500 px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-600 disabled:opacity-60"
      >
        <Gavel className="h-4 w-4" />
        {hasActiveBid ? "Surenchérir" : "Enchérir"}
      </button>
      {hasActiveBid && (
        <button
          type="button"
          onClick={onCancel}
          disabled={canceling}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-hairline px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-4 w-4" /> Retirer
        </button>
      )}
    </form>
  );
}