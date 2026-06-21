import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Receipt, ExternalLink, Loader2, Check, AlertCircle, Clock, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getDjomyPaymentStatus } from "@/lib/api/djomy";
import { formatGNF } from "@/lib/format";
import { cn } from "@/lib/utils";

type PaymentStatus = "initiated" | "pending" | "succeeded" | "failed" | "cancelled" | "refunded";

interface PaymentDetails {
  id: string;
  amount: number;
  status: PaymentStatus;
  payment_method: string | null;
  provider: string;
  djomy_transaction_id: string | null;
  initiated_at: string | null;
  settled_at: string | null;
  payer_phone: string | null;
  contribution_id: string | null;
  error_message: string | null;
}

async function fetchDetails(id: string): Promise<PaymentDetails | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("id, amount, status, payment_method, provider, djomy_transaction_id, initiated_at, settled_at, payer_phone, contribution_id, error_message")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PaymentDetails) ?? null;
}

const STATUS: Record<PaymentStatus, { label: string; cls: string; Icon: typeof Check }> = {
  initiated: { label: "Initialisation",            cls: "bg-muted text-muted-foreground",                  Icon: Loader2 },
  pending:   { label: "En attente confirmation",   cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300", Icon: Clock },
  succeeded: { label: "Paiement confirmé",         cls: "bg-success/10 text-success",                       Icon: Check },
  failed:    { label: "Paiement échoué",           cls: "bg-destructive/10 text-destructive",               Icon: AlertCircle },
  cancelled: { label: "Paiement annulé",           cls: "bg-muted text-muted-foreground",                   Icon: X },
  refunded:  { label: "Remboursé",                 cls: "bg-primary/10 text-primary",                       Icon: Check },
};

function methodLabel(m: string | null): string {
  const x = (m ?? "").toUpperCase();
  if (x === "OM") return "Orange Money";
  if (x === "MOMO") return "MTN Mobile Money";
  if (x === "CARD") return "Carte bancaire";
  return m ?? "—";
}

export function PaymentDetailsDialog({
  paymentId,
  open,
  onOpenChange,
}: { paymentId: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["payment-details", paymentId],
    queryFn: () => fetchDetails(paymentId!),
    enabled: !!paymentId && open,
  });

  // realtime: souscrit aux UPDATE de ce paiement
  useEffect(() => {
    if (!paymentId || !open) return;
    const channel = supabase
      .channel(`payment-details-${paymentId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "payments", filter: `id=eq.${paymentId}` },
        () => qc.invalidateQueries({ queryKey: ["payment-details", paymentId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [paymentId, open, qc]);

  // polling Djomy si non final
  useEffect(() => {
    const tx = q.data?.djomy_transaction_id;
    const status = q.data?.status;
    if (!tx || !status || !open) return;
    if (["succeeded", "failed", "cancelled", "refunded"].includes(status)) return;
    const id = setInterval(() => { void getDjomyPaymentStatus(tx).catch(() => {}); }, 5000);
    return () => clearInterval(id);
  }, [q.data?.djomy_transaction_id, q.data?.status, open]);

  const d = q.data;
  const meta = d ? STATUS[d.status] ?? STATUS.pending : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Détails du paiement</DialogTitle>
          <DialogDescription>Référence Djomy, statut et reçu numérique.</DialogDescription>
        </DialogHeader>

        {q.isLoading || !d ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="space-y-4">
            <div className={cn("flex items-center gap-3 rounded-lg p-3", meta!.cls)}>
              <meta.Icon className={cn("h-5 w-5", (d.status === "initiated" || d.status === "pending") && "animate-spin")} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{meta!.label}</p>
                <p className="text-[11px] opacity-80">Mise à jour en direct dès confirmation Djomy.</p>
              </div>
              <p className="font-semibold num">{formatGNF(d.amount)} GNF</p>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Field label="ID Djomy" value={d.djomy_transaction_id ?? "—"} mono />
              <Field label="Méthode" value={methodLabel(d.payment_method)} />
              <Field label="Numéro payeur" value={d.payer_phone ?? "—"} />
              <Field label="Initié le" value={d.initiated_at ? new Date(d.initiated_at).toLocaleString("fr-FR") : "—"} />
              <Field label="Confirmé le" value={d.settled_at ? new Date(d.settled_at).toLocaleString("fr-FR") : "—"} />
              <Field label="Fournisseur" value={d.provider} />
            </dl>

            {d.error_message && d.status === "failed" && (
              <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{d.error_message}</p>
            )}

            {d.status === "succeeded" && (
              <Link
                to={`/paiement/${d.id}/recu`}
                onClick={() => onOpenChange(false)}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-700"
              >
                <Receipt className="h-4 w-4" /> Voir le reçu PDF <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 font-medium text-foreground break-words", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}