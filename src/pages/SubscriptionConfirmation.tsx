import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertCircle, XCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/layout/TopBar";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlements } from "@/hooks/useEntitlements";

type SubStatus = "active" | "trialing" | "pending" | "past_due" | "cancelled" | "failed" | "unknown";

interface LatestSub {
  id: string;
  plan_code: string;
  status: SubStatus;
  price_monthly: number;
  current_period_end: string | null;
  updated_at: string;
}

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 60_000;

export default function SubscriptionConfirmation() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { refetch: refetchEntitlements } = useEntitlements();

  const planCode = params.get("plan");
  const [sub, setSub] = useState<LatestSub | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const status: SubStatus = sub?.status ?? "unknown";
  const isFinal = status === "active" || status === "trialing" || status === "cancelled" || status === "failed";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const started = Date.now();

    const tick = async () => {
      const query = supabase
        .from("user_subscriptions")
        .select("id, plan_code, status, price_monthly, current_period_end, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      const { data, error: err } = planCode
        ? await query.eq("plan_code", planCode)
        : await query;
      if (cancelled) return;
      if (err) { setError(err.message); return; }
      const row = (data?.[0] as LatestSub | undefined) ?? null;
      setSub(row);
      setElapsed(Date.now() - started);

      const s = row?.status;
      if (s === "active" || s === "trialing") {
        try { sessionStorage.removeItem(`sub_checkout_opts:${row!.plan_code}`); } catch { /* ignore */ }
        void refetchEntitlements();
        return; // stop polling
      }
      if (s === "cancelled" || s === "failed") return;
      if (Date.now() - started > POLL_TIMEOUT_MS) return;
      setTimeout(tick, POLL_INTERVAL_MS);
    };

    void tick();
    return () => { cancelled = true; };
  }, [user, planCode, refetchEntitlements]);

  const view = useMemo(() => {
    if (error) {
      return {
        icon: <XCircle className="h-10 w-10 text-destructive" />,
        title: "Erreur",
        body: error,
        tone: "destructive" as const,
      };
    }
    switch (status) {
      case "active":
      case "trialing":
        return {
          icon: <CheckCircle2 className="h-10 w-10 text-emerald-500" />,
          title: "Abonnement activé",
          body: `Votre abonnement ${sub?.plan_code ?? ""} est maintenant actif. Merci !`,
          tone: "success" as const,
        };
      case "cancelled":
      case "failed":
        return {
          icon: <XCircle className="h-10 w-10 text-destructive" />,
          title: "Paiement non abouti",
          body: "Le paiement a été annulé ou refusé. Vos options sont conservées, vous pouvez réessayer.",
          tone: "destructive" as const,
        };
      case "past_due":
        return {
          icon: <AlertCircle className="h-10 w-10 text-amber-500" />,
          title: "Paiement en attente de régularisation",
          body: "Votre abonnement est en défaut de paiement. Réessayez ou contactez le support.",
          tone: "warning" as const,
        };
      case "pending":
      case "unknown":
      default: {
        const timeout = elapsed > POLL_TIMEOUT_MS;
        return {
          icon: timeout
            ? <AlertCircle className="h-10 w-10 text-amber-500" />
            : <Loader2 className="h-10 w-10 animate-spin text-primary" />,
          title: timeout ? "Confirmation retardée" : "Confirmation en cours…",
          body: timeout
            ? "Nous n'avons pas encore reçu la confirmation Djomy. Elle peut arriver dans quelques minutes — consultez cette page à nouveau ou vos notifications."
            : "Nous attendons la confirmation Djomy. Cela prend habituellement quelques secondes.",
          tone: "info" as const,
        };
      }
    }
  }, [status, error, elapsed, sub?.plan_code]);

  const canRetry = status === "cancelled" || status === "failed" || (status === "unknown" && elapsed > POLL_TIMEOUT_MS);

  return (
    <div className="animate-fade-in">
      <TopBar title="Confirmation" subtitle="Statut de votre abonnement" />
      <div className="mx-auto max-w-md px-5 py-10 text-center space-y-5">
        <div>{view.icon}</div>
        <h1 data-testid="confirmation-title" className="font-display text-xl font-bold text-foreground">{view.title}</h1>
        <p className="text-sm text-muted-foreground">{view.body}</p>

        {sub && (status === "active" || status === "trialing") && (
          <dl className="mx-auto max-w-xs rounded-lg border border-hairline bg-card p-4 text-left text-xs space-y-1">
            <div className="flex justify-between"><dt className="text-muted-foreground">Plan</dt><dd className="font-medium text-foreground">{sub.plan_code}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Statut</dt><dd className="font-medium text-emerald-600 dark:text-emerald-400">{sub.status}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Montant</dt><dd className="font-mono text-foreground">{sub.price_monthly.toLocaleString("fr-FR")} GNF</dd></div>
            {sub.current_period_end && (
              <div className="flex justify-between"><dt className="text-muted-foreground">Échéance</dt><dd className="font-medium text-foreground">{new Date(sub.current_period_end).toLocaleDateString("fr-FR")}</dd></div>
            )}
          </dl>
        )}

        <div className="flex flex-col gap-2 pt-2">
          {(status === "active" || status === "trialing") && (
            <Button asChild className="w-full"><Link to="/dashboard">Aller au tableau de bord <ArrowRight className="h-4 w-4 ml-2" /></Link></Button>
          )}
          {canRetry && planCode && (
            <Button asChild className="w-full"><Link to={`/abonnement/checkout?plan=${planCode}`}>Réessayer le paiement</Link></Button>
          )}
          <Button asChild variant="outline" className="w-full"><Link to="/abonnement">Retour aux abonnements</Link></Button>
        </div>

        {!isFinal && !error && (
          <p className="text-[11px] text-muted-foreground">Cette page se met à jour automatiquement.</p>
        )}
      </div>
    </div>
  );
}