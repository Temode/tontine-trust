import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertCircle, XCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/layout/TopBar";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlements } from "@/hooks/useEntitlements";
import { formatGNF } from "@/lib/format";

type SubStatus = "active" | "trialing" | "pending" | "past_due" | "cancelled" | "failed" | "unknown";

interface LatestSub {
  id: string;
  plan_code: string;
  status: SubStatus;
  price_monthly: number;
  current_period_end: string | null;
  updated_at: string;
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30_000;

export default function SubscriptionConfirmation() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { refetch: refetchEntitlements } = useEntitlements();

  const planCode = params.get("plan");
  const [sub, setSub] = useState<LatestSub | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const settledRef = useRef(false);

  const status: SubStatus = sub?.status ?? "unknown";
  const isFinal = status === "active" || status === "trialing" || status === "cancelled" || status === "failed";

  // Résout l'ID de l'abonnement à suivre (URL → sessionStorage → dernier pending du user).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const applyRow = (row: LatestSub | null) => {
      if (cancelled) return;
      setSub(row);
      const s = row?.status;
      if (s === "active" || s === "trialing") {
        settledRef.current = true;
        try {
          sessionStorage.removeItem(`sub_checkout_opts:${row!.plan_code}`);
          sessionStorage.removeItem("lastDjomySubscriptionId");
          sessionStorage.removeItem("lastDjomySubscriptionTxId");
        } catch { /* ignore */ }
        void refetchEntitlements();
      } else if (s === "cancelled" || s === "failed" || s === "past_due") {
        settledRef.current = true;
      }
    };

    const fetchById = async (id: string): Promise<LatestSub | null> => {
      const { data } = await supabase
        .from("user_subscriptions")
        .select("id, plan_code, status, price_monthly, current_period_end, updated_at")
        .eq("id", id).maybeSingle();
      return (data as LatestSub | null) ?? null;
    };

    const fetchLatest = async (): Promise<LatestSub | null> => {
      const base = supabase
        .from("user_subscriptions")
        .select("id, plan_code, status, price_monthly, current_period_end, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      const isKnownPlan = planCode === "premium" || planCode === "business";
      const { data } = isKnownPlan
        ? await base.eq("plan_code", planCode as "premium" | "business")
        : await base;
      return (data?.[0] as LatestSub | undefined) ?? null;
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;
    const started = Date.now();

    (async () => {
      // 1. Résoudre l'ID cible.
      const urlSid = params.get("sid") ?? params.get("subscriptionId");
      const storedSid = (() => {
        try { return sessionStorage.getItem("lastDjomySubscriptionId"); } catch { return null; }
      })();
      const urlTx = params.get("transactionId") ?? params.get("transaction_id");

      let row: LatestSub | null = null;
      const sid = urlSid ?? storedSid;
      if (sid) row = await fetchById(sid);
      if (!row) row = await fetchLatest();
      applyRow(row);

      const targetId = row?.id ?? sid ?? null;

      // 2. Réconciliation active immédiate (aligné sur PaymentReturn).
      const invokeStatus = async () => {
        try {
          await supabase.functions.invoke("djomy-subscription-status", {
            body: {
              subscriptionId: targetId ?? undefined,
              transactionId: urlTx ?? undefined,
            },
          });
        } catch (e) {
          console.warn("[subscription-confirmation] status invoke failed", e);
        }
      };
      void invokeStatus();

      // 3. Realtime : coupe le spinner dès l'UPDATE.
      if (targetId) {
        channel = supabase
          .channel(`sub-confirm:${targetId}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "user_subscriptions", filter: `id=eq.${targetId}` },
            (payload) => {
              const next = payload.new as LatestSub;
              applyRow(next);
            },
          )
          .subscribe();
      }

      // 4. Polling de secours (au cas où Realtime + webhook manquent).
      const tick = async () => {
        if (cancelled || settledRef.current) return;
        const fresh = targetId ? await fetchById(targetId) : await fetchLatest();
        applyRow(fresh);
        setElapsed(Date.now() - started);
        if (settledRef.current) return;
        if (Date.now() - started > POLL_TIMEOUT_MS) return;
        // Nouvel appel de réconciliation à mi-parcours pour couvrir un webhook manquant.
        if (Date.now() - started > POLL_TIMEOUT_MS / 2) void invokeStatus();
        setTimeout(tick, POLL_INTERVAL_MS);
      };
      setTimeout(tick, POLL_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [user, planCode, params, refetchEntitlements]);

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
      case "trialing": {
        const label = sub?.plan_code === "business" ? "Business" : sub?.plan_code === "premium" ? "Premium" : (sub?.plan_code ?? "");
        return {
          icon: <CheckCircle2 className="h-14 w-14 text-emerald-500" />,
          title: `Félicitations ! Votre abonnement ${label} est activé.`,
          body: "Vous pouvez profiter de toutes les fonctionnalités de votre plan dès maintenant.",
          tone: "success" as const,
        };
      }
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