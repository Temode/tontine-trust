import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getGroup } from "@/lib/api/groups";
import { getMyDepositForGroup, startDepositCheckout } from "@/lib/api/deposits";
import { formatGNF } from "@/lib/format";

const STATUS_TIMELINE = [
  { key: "pending", label: "Initialisation", icon: Clock },
  { key: "paid", label: "Validation Djomy", icon: CheckCircle2 },
  { key: "failed", label: "Échec / annulation", icon: XCircle },
] as const;

/**
 * Écran dédié au dépôt de caution :
 * - confirme le montant attendu,
 * - démarre le checkout Djomy,
 * - reflète l'état (en attente / validé / échoué).
 */
export default function DepositPayment() {
  const { id = "" } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const groupQ = useQuery({
    queryKey: ["group", id],
    queryFn: () => getGroup(id),
    enabled: !!id,
  });
  const depositQ = useQuery({
    queryKey: ["my-deposit", id],
    queryFn: () => getMyDepositForGroup(id),
    enabled: !!id,
  });

  const grp = groupQ.data;
  const dep = depositQ.data;

  const required = !!(grp as { deposit_required?: boolean } | undefined)?.deposit_required;
  const months = Number((grp as { deposit_months?: number } | undefined)?.deposit_months ?? 0);
  const amount = grp ? grp.contribution_amount * months : 0;

  const handlePay = async () => {
    if (!phone.trim()) {
      toast.error("Numéro requis");
      return;
    }
    setSubmitting(true);
    try {
      const res = await startDepositCheckout({
        groupId: id,
        payerPhone: phone,
        returnUrl: window.location.href,
        cancelUrl: window.location.href,
      });
      qc.invalidateQueries({ queryKey: ["my-deposit", id] });
      window.location.href = res.redirectUrl;
    } catch (e) {
      toast.error("Démarrage impossible", { description: (e as Error).message });
      setSubmitting(false);
    }
  };

  if (groupQ.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }
  if (!grp) {
    return <div className="p-8 text-sm text-muted-foreground">Groupe introuvable.</div>;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <button
        type="button"
        onClick={() => nav(-1)}
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>

      <h1 className="font-display text-2xl font-bold">Dépôt de caution</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Groupe « <Link to={`/groupes/${id}`} className="underline">{grp.name}</Link> »
      </p>

      {!required || months < 1 ? (
        <div className="mt-6 rounded-lg border border-border bg-card p-5 text-sm">
          Aucune caution n'est requise pour ce groupe.
        </div>
      ) : (
        <>
          <section className="mt-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Montant à déposer
            </p>
            <p className="mt-1 font-display text-3xl font-bold num">
              {formatGNF(amount)} <span className="text-base font-semibold">GNF</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Soit {months} mois de cotisation ({formatGNF(grp.contribution_amount)} GNF × {months}).
              Remboursable en fin de cycle si vos engagements sont tenus.
            </p>
          </section>

          <section className="mt-5 rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              État du paiement
            </h2>
            <ul className="mt-3 space-y-2">
              {STATUS_TIMELINE.map((step) => {
                const Icon = step.icon;
                const active =
                  (step.key === "pending" && (!dep || dep.status === "pending")) ||
                  (step.key === "paid" && dep?.status === "paid") ||
                  (step.key === "failed" && (dep?.status === "failed" || dep?.status === "cancelled"));
                return (
                  <li
                    key={step.key}
                    className={`flex items-center gap-3 rounded-md border p-3 ${
                      active
                        ? "border-primary bg-primary/5 font-semibold"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{step.label}</span>
                    {active && dep?.paid_at && step.key === "paid" && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(dep.paid_at).toLocaleString("fr-FR")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {dep?.status === "paid" ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">
                <ShieldCheck className="h-4 w-4" />
                Caution validée. Vous pouvez participer normalement.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold uppercase text-muted-foreground">
                  Numéro Mobile Money à débiter
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+224 6XX XX XX XX"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={submitting}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {dep?.status === "failed" ? "Réessayer le paiement" : "Déposer la caution via Djomy"}
                </button>
                {dep?.status === "pending" && dep.redirect_url && (
                  <a
                    href={dep.redirect_url}
                    className="block text-center text-xs text-primary underline"
                  >
                    Reprendre le paiement en cours
                  </a>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}