import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PaymentTracker } from "@/components/payment/PaymentTracker";
import { useAuth } from "@/hooks/useAuth";
import { reconcileDjomyPayments } from "@/hooks/useDjomyPaymentReconciler";


export default function PaymentReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const transactionId = params.get("transactionId") ?? params.get("transaction_id");
  const pidParam = params.get("pid") ?? params.get("paymentId");
  const storedPid = (() => {
    try { return sessionStorage.getItem("lastDjomyPaymentId"); } catch { return null; }
  })();
  const [paymentId, setPaymentId] = useState<string | null>(pidParam ?? storedPid);
  const [resolving, setResolving] = useState(!(pidParam ?? storedPid));

  // Force une réconciliation Djomy immédiate au montage, peu importe la route
  // d'entrée (/payment/return ou /paiement/retour). Évite l'écran "je dois payer"
  // après que l'utilisateur soit revenu via la flèche retour du navigateur.
  useEffect(() => {
    if (!user?.id) return;
    void reconcileDjomyPayments(user.id, { force: true });
  }, [user?.id]);

  useEffect(() => {
    if (paymentId || !transactionId) { setResolving(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("payments")
        .select("id")
        .eq("djomy_transaction_id", transactionId)
        .maybeSingle();
      if (!cancelled) {
        setPaymentId((data as { id: string } | null)?.id ?? null);
        setResolving(false);
      }
    })();
    return () => { cancelled = true; };
  }, [paymentId, transactionId]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 py-10 text-center">
      <h1 className="font-display text-xl font-bold text-foreground">Suivi du paiement</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        Mise à jour automatique dès réception du webhook Djomy.
      </p>
      <div className="w-full">
        {resolving ? (
          <div className="flex items-center justify-center gap-2 rounded-md border border-hairline bg-card px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Récupération du paiement…
          </div>
        ) : paymentId ? (
          <PaymentTracker paymentId={paymentId} />
        ) : (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-4 text-sm text-destructive">
            Paiement introuvable. Vérifiez « Mes cotisations ».
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          to="/cotisations"
          className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Mes cotisations
        </Link>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-700"
        >
          Tableau de bord
        </button>
      </div>
    </div>
  );
}