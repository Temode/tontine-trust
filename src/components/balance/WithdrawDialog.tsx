import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wallet, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatGNF } from "@/lib/format";
import { getPendingPenalty, requestWithdrawal, type WithdrawalMethod } from "@/lib/api/balances";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  available: number;
}

const METHODS: { id: WithdrawalMethod; label: string; hint: string }[] = [
  { id: "OM", label: "Orange Money", hint: "Virement vers votre numéro OM" },
  { id: "MOMO", label: "MTN MoMo", hint: "Virement vers votre numéro MoMo" },
  { id: "CARD", label: "Carte bancaire", hint: "Crédit sur votre carte" },
  { id: "CASH", label: "Retrait espèces", hint: "Coordonné par l'organisateur" },
];

export function WithdrawDialog({ open, onOpenChange, groupId, groupName, available }: Props) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<WithdrawalMethod>("OM");
  const [destination, setDestination] = useState<string>("");

  const { data: penalty = 0 } = useQuery({
    queryKey: ["pending-penalty", groupId],
    queryFn: () => getPendingPenalty(groupId),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: () =>
      requestWithdrawal({
        groupId,
        amount: Number.parseInt(amount, 10),
        method,
        destination: destination.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Demande de retrait enregistrée", {
        description: "Vous serez notifié dès qu'elle est traitée.",
      });
      qc.invalidateQueries({ queryKey: ["my-balances"] });
      qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
      setAmount("");
      setDestination("");
      onOpenChange(false);
    },
    onError: (e: Error) => {
      const msg = e.message?.includes("INSUFFICIENT_BALANCE")
        ? "Solde insuffisant pour ce montant."
        : e.message?.includes("INVALID_AMOUNT")
        ? "Montant invalide."
        : e.message;
      toast.error("Retrait impossible", { description: msg });
    },
  });

  const parsed = Number.parseInt(amount, 10);
  const maxAllowed = Math.max(0, available - penalty);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= maxAllowed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold">
            Retirer de « {groupName} »
          </DialogTitle>
          <DialogDescription>
            Solde disponible :{" "}
            <span className="num font-semibold text-foreground">
              {formatGNF(available, { withCurrency: true })}
            </span>
          </DialogDescription>
        </DialogHeader>

        {penalty > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">
                Pénalité de retard : {formatGNF(penalty, { withCurrency: true })}
              </p>
              <p>
                Ce montant sera prélevé en plus du retrait et versé à la caisse du groupe.
                Montant maximum retirable :{" "}
                <span className="num font-semibold">
                  {formatGNF(maxAllowed, { withCurrency: true })}
                </span>
                .
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Montant à retirer
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={available}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex : 10000"
              className="num mt-1.5 h-11 w-full rounded-md border border-hairline bg-card px-3 text-base font-semibold text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="mt-1.5 flex gap-1.5">
              {[0.25, 0.5, 1].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setAmount(String(Math.floor(available * pct)))}
                  className="rounded-full border border-hairline px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
                >
                  {pct === 1 ? "Tout" : `${pct * 100}%`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Méthode
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left transition",
                    method === m.id
                      ? "border-primary bg-primary-50 text-foreground"
                      : "border-hairline bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <p className="text-sm font-semibold">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground">{m.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {(method === "OM" || method === "MOMO") && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Numéro destinataire
              </label>
              <input
                type="tel"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="+224 6xx xx xx xx"
                className="num mt-1.5 h-11 w-full rounded-md border border-hairline bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-md border border-hairline px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!valid || mut.isPending}
            onClick={() => mut.mutate()}
            className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-700 disabled:opacity-60"
          >
            <Wallet className="h-4 w-4" />
            {mut.isPending ? "Envoi…" : "Confirmer le retrait"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}