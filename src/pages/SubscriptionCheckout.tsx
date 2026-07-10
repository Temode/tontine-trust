import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Check, Loader2, ShieldCheck, Sparkles, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { TopBar } from "@/components/layout/TopBar";
import { formatGNF } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlements } from "@/hooks/useEntitlements";
import type { Database } from "@/integrations/supabase/types";

type Plan = Database["public"]["Tables"]["subscription_plans"]["Row"];

interface TierOption {
  key: string;
  label: string;
  min: number;
  max: number;
  base: number;
  price_step: number;
}

function toTierOptions(v: unknown): TierOption[] {
  const raw = (v as any)?.options;
  if (!Array.isArray(raw)) return [];
  return raw.map((o: any) => ({
    key: String(o.key),
    label: String(o.label ?? o.key),
    min: Number(o.min ?? 0),
    max: Number(o.max ?? 0),
    base: Number(o.base ?? 0),
    price_step: Number(o.price_step ?? 0),
  }));
}

export default function SubscriptionCheckout() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { entitlements } = useEntitlements();

  const planCodeParam = params.get("plan");
  const planCode: "premium" | "business" | null =
    planCodeParam === "premium" || planCodeParam === "business" ? planCodeParam : null;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [opts, setOpts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!planCode) {
      nav("/abonnement", { replace: true });
      return;
    }
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("code", planCode)
        .eq("is_active", true)
        .maybeSingle();
      if (error) toast.error("Chargement du plan", { description: error.message });
      setPlan((data as Plan) ?? null);
      setLoading(false);
    })();
  }, [planCode, nav]);

  const tierOptions = useMemo(
    () => (plan?.code === "premium" ? toTierOptions(plan?.tiers) : []),
    [plan],
  );

  useEffect(() => {
    if (!tierOptions.length) return;
    const init: Record<string, number> = {};
    for (const o of tierOptions) {
      init[o.key] = Number(entitlements.tier_options?.[o.key] ?? o.base);
    }
    setOpts(init);
  }, [tierOptions, entitlements.tier_options]);

  const totalPrice = useMemo(() => {
    if (!plan) return 0;
    if (plan.code !== "premium") return Number(plan.base_price);
    const tiers = (plan.tiers as any) ?? {};
    const min = Number(tiers.min_price ?? plan.base_price);
    const max = Number(tiers.max_price ?? plan.base_price * 4);
    let price = min;
    for (const o of tierOptions) {
      const chosen = opts[o.key] ?? o.base;
      if (chosen > o.base) price += (chosen - o.base) * o.price_step;
    }
    return Math.min(Math.max(price, min), max);
  }, [plan, tierOptions, opts]);

  const publicUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string) || window.location.origin;

  const pay = async () => {
    if (!user) { nav("/auth"); return; }
    if (!plan) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("djomy-init-subscription", {
        body: {
          planCode: plan.code,
          tierOptions: plan.code === "premium" ? opts : {},
          returnUrl: `${publicUrl}/paiement/retour`,
          cancelUrl: `${publicUrl}/abonnement/checkout?plan=${plan.code}`,
        },
      });
      if (error) throw new Error(error.message);
      const res = data as { redirectUrl?: string; error?: string };
      if (!res?.redirectUrl) throw new Error(res?.error ?? "Redirection Djomy indisponible");
      window.location.assign(res.redirectUrl);
    } catch (e) {
      toast.error("Paiement impossible", { description: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div>
        <TopBar title="Récapitulatif" subtitle="Finaliser votre abonnement" />
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div>
        <TopBar title="Récapitulatif" subtitle="Finaliser votre abonnement" />
        <div className="mx-auto max-w-2xl px-5 py-10 text-center space-y-4">
          <p className="text-muted-foreground">Plan introuvable.</p>
          <Button asChild variant="outline"><Link to="/abonnement"><ArrowLeft className="h-4 w-4 mr-2" />Retour aux plans</Link></Button>
        </div>
      </div>
    );
  }

  const isPremium = plan.code === "premium";
  const isBusiness = plan.code === "business";
  const included: string[] = isBusiness
    ? [
        "Groupes illimités",
        "Membres illimités par groupe",
        `${plan.sms_included} SMS/mois inclus`,
        "Tontines Solo & Internationales",
        "Programme d'affiliation & commissions coordinateur",
      ]
    : [
        "Quotas modulables ci-contre",
        `${plan.sms_included} SMS/mois inclus (base)`,
        "Notifications SMS + e-mail + in-app",
        "Support prioritaire",
      ];

  return (
    <div className="animate-fade-in">
      <TopBar title="Récapitulatif" subtitle={`Finaliser votre abonnement ${plan.label}`} />
      <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8 lg:py-10">
        <Link to="/abonnement" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour aux plans
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* LEFT — configuration */}
          <section className="space-y-5">
            <div className="rounded-xl border border-hairline bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                {isPremium ? <Sparkles className="h-4 w-4 text-primary" /> : <Crown className="h-4 w-4 text-amber-500" />}
                <h2 className="font-display text-xl font-bold">{plan.label}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{plan.description ?? (isBusiness ? "Pour les coordinateurs et le programme d'affiliation." : "Pour les utilisateurs actifs, modulable selon vos besoins.")}</p>
              <ul className="space-y-1.5 text-sm pt-1">
                {included.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {isPremium && tierOptions.length > 0 && (
              <div className="rounded-xl border border-hairline bg-card p-5 space-y-4">
                <div>
                  <h3 className="font-display text-base font-semibold">Configurez votre plan</h3>
                  <p className="text-xs text-muted-foreground">Ajustez chaque quota — le prix se met à jour en direct.</p>
                </div>
                <div className="space-y-4">
                  {tierOptions.map((o) => (
                    <div key={o.key}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground font-medium">{o.label}</span>
                        <span className="font-mono text-primary">{opts[o.key] ?? o.base}</span>
                      </div>
                      <Slider
                        value={[opts[o.key] ?? o.base]}
                        min={o.min}
                        max={o.max}
                        step={1}
                        onValueChange={(v) => setOpts((prev) => ({ ...prev, [o.key]: v[0] }))}
                        className="mt-2"
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Min {o.min} · Base {o.base} · Max {o.max} · +{formatGNF(o.price_step)} GNF / unité au-dessus de la base
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* RIGHT — order summary */}
          <aside className="lg:sticky lg:top-6 self-start">
            <div className="rounded-xl border-2 border-primary/30 bg-card p-5 space-y-4 shadow-sm">
              <h3 className="font-display text-base font-semibold">Résumé de la commande</h3>

              <div className="flex items-start justify-between text-sm">
                <div>
                  <p className="font-medium text-foreground">Abonnement {plan.label}</p>
                  <p className="text-xs text-muted-foreground">Facturation mensuelle</p>
                </div>
                <p className="font-mono text-foreground">{formatGNF(totalPrice)} GNF</p>
              </div>

              <div className="border-t border-hairline pt-3 flex items-baseline justify-between">
                <span className="text-sm font-medium text-foreground">Total</span>
                <span data-testid="checkout-total" className="text-2xl font-bold text-foreground">
                  {formatGNF(totalPrice)} <span className="text-xs font-normal text-muted-foreground">GNF / mois</span>
                </span>
              </div>

              <Button
                onClick={pay}
                disabled={busy || totalPrice <= 0}
                className="w-full h-11"
                data-testid="checkout-pay"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Procéder au paiement
              </Button>

              <p className="inline-flex items-start gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>Paiement sécurisé par Djomy (OM, MoMo, carte). Résiliable à tout moment. Le numéro de téléphone vous sera demandé sur l'écran Djomy si nécessaire.</span>
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}