import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, AlertCircle, X, Clock, Receipt, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getDjomyPaymentStatus } from "@/lib/api/djomy";
import { cn } from "@/lib/utils";

type PaymentStatus = "initiated" | "pending" | "succeeded" | "failed" | "cancelled" | "refunded";

interface PaymentRow {
  id: string;
  status: PaymentStatus;
  amount: number;
  payment_method: string | null;
  djomy_transaction_id: string | null;
  initiated_at: string | null;
  settled_at: string | null;
  error_message: string | null;
}

async function fetchPayment(id: string): Promise<PaymentRow | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("id, status, amount, payment_method, djomy_transaction_id, initiated_at, settled_at, error_message")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PaymentRow) ?? null;
}

const STATUS_META: Record<PaymentStatus, { label: string; icon: typeof Check; cls: string }> = {
  initiated:  { label: "Initialisation",       icon: Loader2,     cls: "bg-muted text-muted-foreground" },
  pending:    { label: "En attente confirmation", icon: Clock,    cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  succeeded:  { label: "Paiement confirmé",    icon: Check,       cls: "bg-success/10 text-success" },
  failed:     { label: "Paiement échoué",      icon: AlertCircle, cls: "bg-destructive/10 text-destructive" },
  cancelled:  { label: "Paiement annulé",      icon: X,           cls: "bg-muted text-muted-foreground" },
  refunded:   { label: "Remboursé",            icon: Check,       cls: "bg-primary/10 text-primary" },
};

/**
 * Suivi temps-réel d'un paiement. Souscrit aux UPDATE de la table `payments`
 * et invalide les caches contributions/dashboard sur "succeeded".
 */
export function PaymentTracker({ paymentId, compact = false }: { paymentId: string; compact?: boolean }) {
  const qc = useQueryClient();
  const [, force] = useState(0);

  const q = useQuery({
    queryKey: ["payment", paymentId],
    queryFn: () => fetchPayment(paymentId),
    refetchInterval: (data) => {
      const s = (data as unknown as { state: { data?: PaymentRow | null } })?.state?.data?.status;
      // fallback polling tant que non final, au cas où realtime ne soit pas dispo
      return s === "succeeded" || s === "failed" || s === "cancelled" || s === "refunded" ? false : 4000;
    },
  });

  // Réconciliation active avec Djomy : si le webhook tarde / échoue, on interroge
  // directement le statut chez Djomy toutes les 5 s tant que le paiement n'est pas final.
  useEffect(() => {
    const tx = q.data?.djomy_transaction_id;
    const status = q.data?.status;
    if (!tx || !status) return;
    if (status === "succeeded" || status === "failed" || status === "cancelled" || status === "refunded") return;
    let cancelled = false;
    const tick = async () => {
      try {
        await getDjomyPaymentStatus(tx);
        if (!cancelled) qc.invalidateQueries({ queryKey: ["payment", paymentId] });
      } catch { /* ignore — on retentera */ }
    };
    void tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [q.data?.djomy_transaction_id, q.data?.status, paymentId, qc]);

  useEffect(() => {
    const channel = supabase
      .channel(`payment-${paymentId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "payments", filter: `id=eq.${paymentId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["payment", paymentId] });
          force((n) => n + 1);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [paymentId, qc]);

  // invalide les listes une fois le paiement final
  useEffect(() => {
    const s = q.data?.status;
    if (s === "succeeded") {
      qc.invalidateQueries({ queryKey: ["contributions"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["turns"] });
    }
  }, [q.data?.status, qc]);

  if (q.isLoading || !q.data) {
    return (
      <div className={cn("flex items-center gap-2 rounded-md border border-hairline bg-card px-3 py-2 text-xs text-muted-foreground", compact && "py-1.5")}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement du paiement…
      </div>
    );
  }

  const meta = STATUS_META[q.data.status] ?? STATUS_META.pending;
  const Icon = meta.icon;
  const animate = q.data.status === "initiated" || q.data.status === "pending";

  return (
    <div className={cn("rounded-lg border border-hairline bg-card", compact ? "px-3 py-2" : "p-4")}>
      <div className="flex items-center gap-3">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-md", meta.cls)}>
          <Icon className={cn("h-4 w-4", animate && "animate-spin")} strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{meta.label}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {q.data.payment_method ?? "Djomy"}
            {q.data.djomy_transaction_id && <> · <span className="font-mono">{q.data.djomy_transaction_id.slice(0, 12)}…</span></>}
          </p>
        </div>
        <span className="text-xs font-semibold text-foreground num">
          {Intl.NumberFormat("fr-FR").format(q.data.amount)} GNF
        </span>
      </div>
      {q.data.status === "failed" && q.data.error_message && (
        <p className="mt-2 text-[11px] text-destructive">{q.data.error_message}</p>
      )}
      {(q.data.status === "initiated" || q.data.status === "pending") && !compact && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Mise à jour automatique dès réception de la confirmation Djomy.
        </p>
      )}
      {q.data.status === "succeeded" && !compact && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-hairline pt-3">
          <Link
            to={`/paiement/${paymentId}/recu`}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Receipt className="h-3.5 w-3.5" /> Voir le reçu <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/recus"
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Tous mes reçus
          </Link>
        </div>
      )}
    </div>
  );
}
