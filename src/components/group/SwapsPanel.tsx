import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRightLeft, Check, X, Send } from "lucide-react";
import {
  listGroupSwapRequests,
  requestTurnSwap,
  respondTurnSwap,
  cancelTurnSwap,
  type DbSwapRequest,
} from "@/lib/api/swaps";
import { listGroupTurns } from "@/lib/api/turns";
import type { DbNextTurn } from "@/lib/api/types";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<DbSwapRequest["status"], string> = {
  pending: "En attente",
  accepted: "Accepté",
  rejected: "Refusé",
  cancelled: "Annulé",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function SwapsPanel({
  groupId,
  currentUserId,
  swapPolicy,
}: {
  groupId: string;
  currentUserId: string | null;
  swapPolicy: "none" | "with_consent" | "organizer_only";
}) {
  const qc = useQueryClient();
  const [showProposeForm, setShowProposeForm] = useState(false);
  const [fromTurnId, setFromTurnId] = useState("");
  const [toTurnId, setToTurnId] = useState("");
  const [reason, setReason] = useState("");

  const swapsQ = useQuery({
    queryKey: ["group", groupId, "swaps"],
    queryFn: () => listGroupSwapRequests(groupId),
  });
  const turnsQ = useQuery({
    queryKey: ["group", groupId, "turns"],
    queryFn: () => listGroupTurns(groupId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["group", groupId, "swaps"] });
    qc.invalidateQueries({ queryKey: ["group", groupId, "turns"] });
  };

  const proposeM = useMutation({
    mutationFn: () =>
      requestTurnSwap({ fromTurnId, toTurnId, reason: reason.trim() || undefined }),
    onSuccess: () => {
      toast.success("Demande envoyée");
      setShowProposeForm(false);
      setFromTurnId(""); setToTurnId(""); setReason("");
      invalidate();
    },
    onError: (e: Error) => toast.error("Demande impossible", { description: e.message }),
  });

  const respondM = useMutation({
    mutationFn: (v: { id: string; accept: boolean }) => respondTurnSwap(v.id, v.accept),
    onSuccess: (_d, v) => {
      toast.success(v.accept ? "Échange accepté" : "Échange refusé");
      invalidate();
    },
    onError: (e: Error) => toast.error("Action impossible", { description: e.message }),
  });

  const cancelM = useMutation({
    mutationFn: (id: string) => cancelTurnSwap(id),
    onSuccess: () => { toast.success("Demande annulée"); invalidate(); },
    onError: (e: Error) => toast.error("Annulation impossible", { description: e.message }),
  });

  const turns = turnsQ.data ?? [];
  const myUpcomingTurns = useMemo(
    () => turns.filter((t) => t.status === "upcoming" && t.beneficiary_user_id === currentUserId),
    [turns, currentUserId],
  );
  const otherUpcomingTurns = useMemo(
    () => turns.filter((t) => t.status === "upcoming" && t.beneficiary_user_id !== currentUserId),
    [turns, currentUserId],
  );

  const swaps = swapsQ.data ?? [];
  const incoming = swaps.filter((s) => s.status === "pending" && s.to_user_id === currentUserId);
  const outgoing = swaps.filter((s) => s.status === "pending" && s.from_user_id === currentUserId);
  const history = swaps.filter((s) => s.status !== "pending");

  const canPropose =
    swapPolicy !== "none" && myUpcomingTurns.length > 0 && otherUpcomingTurns.length > 0;

  return (
    <div className="space-y-5">
      <SectionCard
        title="Échanges de tours"
        subtitle={
          swapPolicy === "none"
            ? "Échanges désactivés par l'organisateur"
            : swapPolicy === "organizer_only"
            ? "Réservés à l'organisateur"
            : "Avec consentement des deux parties"
        }
      >
        {canPropose && !showProposeForm && (
          <button
            type="button"
            onClick={() => setShowProposeForm(true)}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Proposer un échange
          </button>
        )}

        {showProposeForm && (
          <div className="space-y-3 rounded-lg border border-hairline bg-secondary/30 p-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Mon tour à échanger</label>
              <select
                value={fromTurnId}
                onChange={(e) => setFromTurnId(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-card px-3 py-2 text-sm"
              >
                <option value="">— Choisir —</option>
                {myUpcomingTurns.map((t) => (
                  <option key={t.turn_id} value={t.turn_id}>
                    Tour #{t.turn_number} · {fmtDate(t.due_date)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tour souhaité</label>
              <select
                value={toTurnId}
                onChange={(e) => setToTurnId(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-card px-3 py-2 text-sm"
              >
                <option value="">— Choisir —</option>
                {otherUpcomingTurns.map((t) => (
                  <option key={t.turn_id} value={t.turn_id}>
                    Tour #{t.turn_number} · {fmtDate(t.due_date)} · {t.beneficiary_name ?? "Membre"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Raison (facultatif)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={280}
                className="mt-1 w-full rounded-md border border-hairline bg-card px-3 py-2 text-sm"
                placeholder="Ex : urgence médicale, voyage…"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!fromTurnId || !toTurnId || proposeM.isPending}
                onClick={() => proposeM.mutate()}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {proposeM.isPending ? "Envoi…" : "Envoyer la demande"}
              </button>
              <button
                type="button"
                onClick={() => setShowProposeForm(false)}
                className="inline-flex h-10 items-center rounded-md border border-hairline px-4 text-sm font-medium text-muted-foreground hover:bg-secondary"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {!canPropose && !showProposeForm && swapPolicy !== "none" && (
          <p className="text-sm text-muted-foreground">
            {myUpcomingTurns.length === 0
              ? "Vous n'avez aucun tour à venir à échanger."
              : "Aucun autre tour à venir disponible."}
          </p>
        )}
      </SectionCard>

      {incoming.length > 0 && (
        <SectionCard title="Demandes reçues" subtitle={`${incoming.length} en attente`} bare>
          <ul className="divide-y divide-border/60">
            {incoming.map((s) => (
              <SwapRow
                key={s.id} swap={s} direction="incoming"
                onAccept={() => respondM.mutate({ id: s.id, accept: true })}
                onReject={() => respondM.mutate({ id: s.id, accept: false })}
                busy={respondM.isPending}
              />
            ))}
          </ul>
        </SectionCard>
      )}

      {outgoing.length > 0 && (
        <SectionCard title="Demandes envoyées" subtitle={`${outgoing.length} en attente`} bare>
          <ul className="divide-y divide-border/60">
            {outgoing.map((s) => (
              <SwapRow
                key={s.id} swap={s} direction="outgoing"
                onCancel={() => cancelM.mutate(s.id)}
                busy={cancelM.isPending}
              />
            ))}
          </ul>
        </SectionCard>
      )}

      {history.length > 0 && (
        <SectionCard title="Historique" subtitle={`${history.length} demande${history.length>1?"s":""}`} bare>
          <ul className="divide-y divide-border/60">
            {history.slice(0, 10).map((s) => (
              <SwapRow key={s.id} swap={s} direction="history" />
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function SwapRow({
  swap, direction, onAccept, onReject, onCancel, busy,
}: {
  swap: DbSwapRequest;
  direction: "incoming" | "outgoing" | "history";
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  busy?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3.5 lg:px-6">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-foreground">
        <ArrowRightLeft className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {swap.from_user_name ?? "Membre"} (tour #{swap.from_turn_number} · {fmtDate(swap.from_due_date)})
          {" ↔ "}
          {swap.to_user_name ?? "Membre"} (tour #{swap.to_turn_number} · {fmtDate(swap.to_due_date)})
        </p>
        <p className="text-xs text-muted-foreground">
          {STATUS_LABEL[swap.status]} · {new Date(swap.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          {swap.reason ? ` · « ${swap.reason} »` : ""}
        </p>
      </div>
      {direction === "incoming" && (
        <div className="flex gap-2">
          <button
            type="button" disabled={busy} onClick={onAccept}
            className="inline-flex h-9 items-center gap-1 rounded-md bg-success px-3 text-xs font-semibold text-success-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" /> Accepter
          </button>
          <button
            type="button" disabled={busy} onClick={onReject}
            className="inline-flex h-9 items-center gap-1 rounded-md border border-hairline px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> Refuser
          </button>
        </div>
      )}
      {direction === "outgoing" && (
        <button
          type="button" disabled={busy} onClick={onCancel}
          className="inline-flex h-9 items-center gap-1 rounded-md border border-hairline px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> Annuler
        </button>
      )}
      {direction === "history" && (
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
          swap.status === "accepted" && "bg-success/15 text-success",
          swap.status === "rejected" && "bg-destructive/15 text-destructive",
          swap.status === "cancelled" && "bg-muted text-muted-foreground",
        )}>
          {STATUS_LABEL[swap.status]}
        </span>
      )}
    </li>
  );
}