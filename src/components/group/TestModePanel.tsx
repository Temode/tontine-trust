import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Loader2, RefreshCcw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listMyContributionsDue, type DbContributionDue } from "@/lib/api/contributions";
import { getDjomyPaymentStatus } from "@/lib/api/djomy";
import { DjomyPaymentModal } from "@/components/payment/DjomyPaymentModal";
import { formatGNF } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  groupId: string;
  groupName: string;
}

interface PaymentRow {
  id: string;
  amount: number;
  status: string;
  payment_method: string | null;
  djomy_transaction_id: string | null;
  created_at: string;
}

async function listGroupPayments(groupId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("id, amount, status, payment_method, djomy_transaction_id, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []) as unknown as PaymentRow[];
}

const STATUS_COLOR: Record<string, string> = {
  succeeded: "bg-success/15 text-success",
  pending: "bg-amber-100 text-amber-800",
  initiated: "bg-blue-100 text-blue-800",
  failed: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-muted text-muted-foreground",
};

export function TestModePanel({ groupId, groupName }: Props) {
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const duesQ = useQuery({ queryKey: ["contributions", "due"], queryFn: listMyContributionsDue });
  const paymentsQ = useQuery({
    queryKey: ["group", groupId, "payments-test"],
    queryFn: () => listGroupPayments(groupId),
    refetchInterval: 10_000,
  });

  const myDue: DbContributionDue | undefined = (duesQ.data ?? [])
    .filter((d) => d.group_id === groupId && d.status !== "submitted")
    .sort((a, b) => a.turn_number - b.turn_number)[0];

  const handleCheck = async (txId: string | null, paymentId: string) => {
    if (!txId) {
      toast.error("Statut indisponible", { description: "Aucun identifiant Djomy lié à ce paiement." });
      return;
    }
    setCheckingId(paymentId);
    try {
      const res = await getDjomyPaymentStatus(txId);
      toast.success(`Statut : ${res.status}`, { description: `Paiement ${paymentId.slice(0, 8)}…` });
      qc.invalidateQueries({ queryKey: ["group", groupId, "payments-test"] });
    } catch (e) {
      toast.error("Vérification échouée", { description: (e as Error).message });
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-200 text-amber-800">
          <FlaskConical className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800">Mode test</p>
          <h3 className="mt-0.5 font-display text-sm font-bold text-foreground">
            Simulation rapide d'un cycle de paiement
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Déclenchez un paiement Djomy réel (montant minimum 1 000 GNF) et vérifiez son statut sans attendre l'échéance.
            Utilisez un groupe configuré en cotisation faible et fréquence quotidienne pour tester en quelques minutes.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-hairline bg-card p-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Lancer un paiement test
        </h4>
        {myDue ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-foreground">
              Cotisation en attente :{" "}
              <span className="font-display font-bold num">{formatGNF(myDue.amount)} GNF</span>{" "}
              <span className="text-muted-foreground">(tour {myDue.turn_number})</span>
            </p>
            <button
              type="button"
              onClick={() => setPayOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-700"
            >
              <Wallet className="h-4 w-4" />
              Démarrer un paiement Djomy
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Aucune cotisation en attente pour vous dans ce groupe. Démarrez d'abord le cycle ou attendez votre tour de cotisation.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-hairline bg-card">
        <header className="flex items-center justify-between border-b border-hairline px-5 py-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            10 derniers paiements du groupe
          </h4>
          <button
            type="button"
            onClick={() => qc.invalidateQueries({ queryKey: ["group", groupId, "payments-test"] })}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-2.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Actualiser
          </button>
        </header>
        <div className="divide-y divide-hairline">
          {(paymentsQ.data ?? []).length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">Aucun paiement enregistré pour ce groupe.</p>
          )}
          {(paymentsQ.data ?? []).map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[11px] text-muted-foreground">{p.id}</p>
                <p className="mt-0.5 text-sm text-foreground">
                  <span className="font-display font-bold num">{formatGNF(p.amount)} GNF</span>
                  {p.payment_method && <span className="ml-2 text-xs text-muted-foreground">· {p.payment_method}</span>}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px] font-semibold",
                  STATUS_COLOR[p.status] ?? "bg-muted text-muted-foreground",
                )}
              >
                {p.status}
              </span>
              <button
                type="button"
                onClick={() => handleCheck(p.djomy_transaction_id, p.id)}
                disabled={checkingId === p.id || !p.djomy_transaction_id}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-2.5 text-xs text-foreground transition hover:bg-secondary disabled:opacity-50"
              >
                {checkingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                Vérifier Djomy
              </button>
            </div>
          ))}
        </div>
      </div>

      {myDue && (
        <DjomyPaymentModal
          open={payOpen}
          onOpenChange={setPayOpen}
          contributionId={myDue.contribution_id}
          groupName={groupName}
          amount={myDue.amount}
        />
      )}
    </section>
  );
}