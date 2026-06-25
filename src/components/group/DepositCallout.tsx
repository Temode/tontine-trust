import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getMyDepositForGroup, startDepositCheckout } from "@/lib/api/deposits";
import { formatGNF } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

interface DepositCalloutProps {
  groupId: string;
  groupName: string;
  contributionAmount: number;
  depositRequired: boolean;
  depositMonths: number;
  /** Statut côté membre (group_members.deposit_status). */
  memberDepositStatus: string | null;
}

/**
 * Bannière affichée à un nouveau membre rejoignant une tontine en cours
 * qui exige une caution. Renvoie sur Djomy pour le dépôt.
 */
export function DepositCallout({
  groupId,
  groupName,
  contributionAmount,
  depositRequired,
  depositMonths,
  memberDepositStatus,
}: DepositCalloutProps) {
  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState("");

  const depositQ = useQuery({
    queryKey: ["my-deposit", groupId],
    queryFn: () => getMyDepositForGroup(groupId),
    enabled: depositRequired,
  });

  if (!depositRequired || depositMonths < 1) return null;
  if (memberDepositStatus === "paid" || memberDepositStatus === "refunded") return null;
  if (memberDepositStatus === "not_required") return null;

  const amount = contributionAmount * depositMonths;
  const deposit = depositQ.data;

  const handlePay = async () => {
    if (!phone.trim()) {
      toast.error("Numéro requis", { description: "Saisissez le numéro Mobile Money à débiter." });
      return;
    }
    setSubmitting(true);
    try {
      const { data: profile } = await supabase.auth.getUser();
      const fallback = profile.user?.phone ?? "";
      const res = await startDepositCheckout({
        groupId,
        payerPhone: phone || fallback,
        returnUrl: window.location.href,
        cancelUrl: window.location.href,
      });
      window.location.href = res.redirectUrl;
    } catch (e) {
      toast.error("Démarrage impossible", { description: (e as Error).message });
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-5 rounded-xl border-2 border-amber-400 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Banknote className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
            Caution requise
          </p>
          <h3 className="mt-0.5 font-display text-base font-bold text-amber-950">
            Déposez votre caution pour activer votre participation
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-amber-900/90">
            Vous avez rejoint « {groupName} » alors que le cycle était déjà démarré. Pour
            sécuriser votre place, déposez une caution de{" "}
            <strong className="num">{formatGNF(amount)} GNF</strong>{" "}
            ({depositMonths} {depositMonths > 1 ? "mois" : "mois"} de cotisation).
            Elle vous sera intégralement remboursée à la fin du cycle si vous honorez
            vos engagements.
          </p>

          {deposit?.status === "failed" && (
            <p className="mt-2 text-xs text-destructive">
              Le dernier paiement a échoué. Vous pouvez réessayer.
            </p>
          )}
          {deposit?.status === "pending" && deposit.redirect_url && (
            <a
              href={deposit.redirect_url}
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border-2 border-amber-600 bg-white px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
            >
              <ShieldCheck className="h-4 w-4" />
              Reprendre le paiement Djomy
            </a>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs font-semibold text-amber-900">
              Numéro Mobile Money à débiter
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+224 6XX XX XX XX"
                className="mt-1 h-10 w-56 rounded-md border border-amber-300 bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              />
            </label>
            <button
              type="button"
              onClick={handlePay}
              disabled={submitting}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "Redirection…" : "Déposer la caution"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-amber-800/80">
            Aucun débit n'est exécuté tant que vous n'avez pas validé sur le portail Djomy.
          </p>
        </div>
      </div>
    </section>
  );
}