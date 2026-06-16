import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { getDjomyPaymentStatus, type PaymentStatusResult } from "@/lib/api/djomy";

type UiStatus = "loading" | "pending" | "succeeded" | "failed" | "cancelled";

export default function PaymentReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const transactionId = params.get("transactionId") ?? params.get("transaction_id");
  const initialStatus = (params.get("status") ?? "").toUpperCase();
  const [status, setStatus] = useState<UiStatus>("loading");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!transactionId) {
      setStatus("failed");
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res: PaymentStatusResult = await getDjomyPaymentStatus(transactionId);
        if (cancelled) return;
        if (res.status === "succeeded") {
          setStatus("succeeded");
          qc.invalidateQueries({ queryKey: ["contributions"] });
          qc.invalidateQueries({ queryKey: ["payments"] });
          qc.invalidateQueries({ queryKey: ["turns"] });
          qc.invalidateQueries({ queryKey: ["dashboard"] });
          return;
        }
        if (res.status === "failed") return setStatus("failed");
        if (res.status === "cancelled") return setStatus("cancelled");
        setStatus("pending");
        if (attempts < 10) {
          setTimeout(() => setAttempts((a) => a + 1), 3000);
        }
      } catch {
        if (!cancelled) setStatus(initialStatus === "SUCCESS" ? "pending" : "failed");
      }
    };
    poll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId, attempts]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 py-10 text-center">
      {status === "loading" || status === "pending" ? (
        <>
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">Vérification du paiement…</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Confirmez la transaction sur votre téléphone Mobile Money. Cette page se met à jour automatiquement.
          </p>
        </>
      ) : status === "succeeded" ? (
        <>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
            <Check className="h-7 w-7 text-success" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-xl font-bold text-foreground">Paiement confirmé</h1>
          <p className="mt-2 text-sm text-muted-foreground">Votre cotisation a bien été enregistrée.</p>
        </>
      ) : (
        <>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="font-display text-xl font-bold text-foreground">
            {status === "cancelled" ? "Paiement annulé" : "Paiement non abouti"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Vous pouvez réessayer depuis la page « Mes cotisations ».
          </p>
        </>
      )}

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