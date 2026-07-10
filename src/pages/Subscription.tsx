import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Crown, Sparkles, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { TopBar } from "@/components/layout/TopBar";
import { formatGNF } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlements } from "@/hooks/useEntitlements";
import type { Database } from "@/integrations/supabase/types";

type Plan = Database["public"]["Tables"]["subscription_plans"]["Row"];
type PlanCode = Plan["code"];

interface PremiumTierOption {
  key: string;
  label: string;
  min: number;
  max: number;
  base: number;
  price_step: number;
}

function toTierOptions(v: unknown): PremiumTierOption[] {
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

export default function Subscription() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { entitlements, refetch } = useEntitlements();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [payerPhone, setPayerPhone] = useState("");
  const [busy, setBusy] = useState<PlanCode | null>(null);
  const [premiumOpts, setPremiumOpts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("subscription_plans").select("*")
        .eq("is_active", true)
        .order("base_price");
      if (error) toast.error("Chargement plans", { description: error.message });
      setPlans(data ?? []);
      setLoading(false);
    })();
  }, []);

  const premiumPlan = plans?.find((p) => p.code === "premium");
  const businessPlan = plans?.find((p) => p.code === "business");
  const freePlan = plans?.find((p) => p.code === "free");

  const tierOptions = useMemo(() => toTierOptions(premiumPlan?.tiers), [premiumPlan]);

  // initialise Premium sliders with current subscription or plan defaults
  useEffect(() => {
    if (!tierOptions.length) return;
    const init: Record<string, number> = {};
    for (const o of tierOptions) {
      init[o.key] = Number(entitlements.tier_options?.[o.key] ?? o.base);
    }
    setPremiumOpts(init);
  }, [tierOptions, entitlements.tier_options]);

  const premiumPrice = useMemo(() => {
    if (!premiumPlan) return 0;
    const tiers = (premiumPlan.tiers as any) ?? {};
    const min = Number(tiers.min_price ?? premiumPlan.base_price);
    const max = Number(tiers.max_price ?? premiumPlan.base_price * 4);
    let price = min;
    for (const o of tierOptions) {
      const chosen = premiumOpts[o.key] ?? o.base;
      if (chosen > o.base) price += (chosen - o.base) * o.price_step;
    }
    return Math.min(Math.max(price, min), max);
  }, [premiumPlan, tierOptions, premiumOpts]);

  const publicUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string) || window.location.origin;

  const startCheckout = async (planCode: "premium" | "business") => {
    if (!user) { nav("/auth"); return; }
    if (!payerPhone || payerPhone.replace(/\D/g, "").length < 8) {
      toast.error("Téléphone requis", { description: "Renseignez le numéro Mobile Money du payeur." });
      return;
    }
    setBusy(planCode);
    try {
      const { data, error } = await supabase.functions.invoke("djomy-init-subscription", {
        body: {
          planCode,
          tierOptions: planCode === "premium" ? premiumOpts : {},
          payerPhone,
          returnUrl: `${publicUrl}/paiement/retour`,
          cancelUrl: `${publicUrl}/abonnement`,
        },
      });
      if (error) throw new Error(error.message);
      const res = data as { redirectUrl?: string; error?: string };
      if (!res?.redirectUrl) throw new Error(res?.error ?? "Redirection Djomy indisponible");
      window.location.href = res.redirectUrl;
    } catch (e) {
      toast.error("Paiement impossible", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const activateFree = async () => {
    setBusy("free");
    try {
      const { error } = await supabase.rpc("start_subscription_checkout", {
        _plan_code: "free",
        _tier_options: {},
      });
      if (error) throw error;
      toast.success("Plan Free activé");
      await refetch();
    } catch (e) {
      toast.error("Impossible", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  if (loading || !plans) {
    return (
      <div>
        <TopBar title="Abonnement" subtitle="Choisissez le plan adapté à vos tontines" />
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const currentPlan = entitlements.plan_code;

  return (
    <div className="animate-fade-in">
      <TopBar title="Abonnement" subtitle="Choisissez le plan adapté à vos tontines" />
      <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8 lg:py-10 space-y-8">
        {entitlements.read_only && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
            Votre abonnement est expiré ou en défaut de paiement — l'application est en <strong>mode lecture seule</strong>. Choisissez un plan pour réactiver vos groupes.
          </div>
        )}

        <section className="rounded-lg border border-hairline bg-card p-4 lg:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Plan actuel</p>
              <p className="font-display text-lg font-semibold text-foreground">{entitlements.plan_label} <span className="text-xs text-muted-foreground">({entitlements.status})</span></p>
              <p className="text-xs text-muted-foreground">
                {entitlements.usage.groups}/{entitlements.limits.max_groups === -1 ? "∞" : entitlements.limits.max_groups} groupes actifs · {entitlements.sms_included} SMS/mois inclus
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {entitlements.current_period_end
                ? <>Prochaine échéance : <strong>{new Date(entitlements.current_period_end).toLocaleDateString("fr-FR")}</strong></>
                : "Aucune échéance"}
            </div>
          </div>
        </section>

        <section>
          <label className="text-xs font-medium text-muted-foreground">Téléphone Mobile Money (pour le paiement)</label>
          <Input value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)} placeholder="+224 XXX XXX XXX" className="mt-1 max-w-xs" />
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* FREE */}
          {freePlan && (
            <PlanCard
              title={freePlan.label}
              subtitle="Pour découvrir Tontine Digital"
              price={0}
              accent="secondary"
              current={currentPlan === "free"}
              features={[
                `${(freePlan.limits as any)?.max_groups ?? 2} groupes maximum`,
                `${(freePlan.limits as any)?.max_members_per_group ?? 5} membres par groupe`,
                "Notifications e-mail & in-app",
                "Pas de SMS",
              ]}
              cta={currentPlan === "free" ? "Plan actuel" : "Passer en Free"}
              disabled={currentPlan === "free" || busy !== null}
              onClick={activateFree}
            />
          )}

          {/* PREMIUM */}
          {premiumPlan && (
            <div className="rounded-xl border-2 border-primary/40 bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="font-display text-lg font-bold">{premiumPlan.label}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">Modulez vos quotas</p>
                </div>
                {currentPlan === "premium" && <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Actuel</span>}
              </div>

              <div>
                <p className="text-3xl font-bold text-foreground">{formatGNF(premiumPrice)} <span className="text-xs font-normal text-muted-foreground">GNF / mois</span></p>
                <p className="text-[11px] text-muted-foreground">{premiumPlan.sms_included} SMS/mois inclus · calcul instantané ci-dessous</p>
              </div>

              <div className="space-y-3">
                {tierOptions.map((o) => (
                  <div key={o.key}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{o.label}</span>
                      <span className="font-mono text-primary">{premiumOpts[o.key] ?? o.base}</span>
                    </div>
                    <Slider
                      value={[premiumOpts[o.key] ?? o.base]}
                      min={o.min}
                      max={o.max}
                      step={1}
                      onValueChange={(v) => setPremiumOpts((prev) => ({ ...prev, [o.key]: v[0] }))}
                      className="mt-1"
                    />
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Base {o.base} · +{formatGNF(o.price_step)} GNF / unité</p>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => startCheckout("premium")}
                disabled={busy !== null}
                className="w-full"
              >
                {busy === "premium" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {currentPlan === "premium" ? "Mettre à jour l'abonnement" : "Passer au Premium"}
              </Button>
            </div>
          )}

          {/* BUSINESS */}
          {businessPlan && (
            <PlanCard
              title={businessPlan.label}
              subtitle="Coordinateurs, commissions, affiliation"
              price={businessPlan.base_price}
              accent="warning"
              current={currentPlan === "business"}
              icon={<Crown className="h-4 w-4 text-amber-500" />}
              features={[
                "Groupes illimités",
                "Membres illimités par groupe",
                `${businessPlan.sms_included} SMS/mois inclus`,
                "Tontines Solo & Internationales",
                "Programme d'affiliation",
              ]}
              cta={currentPlan === "business" ? "Plan actuel" : "Passer au Business"}
              disabled={currentPlan === "business" || busy !== null}
              loading={busy === "business"}
              onClick={() => startCheckout("business")}
            />
          )}
        </div>

        <p className="inline-flex items-start gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>Paiement sécurisé par Djomy (OM, MoMo, carte). Facturation mensuelle, résiliable à tout moment.</span>
        </p>
      </div>
    </div>
  );
}

function PlanCard(props: {
  title: string;
  subtitle: string;
  price: number;
  accent: "secondary" | "primary" | "warning";
  current?: boolean;
  icon?: React.ReactNode;
  features: string[];
  cta: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className={`rounded-xl border p-5 space-y-4 bg-card ${props.current ? "border-primary/40" : "border-hairline"}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            {props.icon}
            <h3 className="font-display text-lg font-bold">{props.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground">{props.subtitle}</p>
        </div>
        {props.current && <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Actuel</span>}
      </div>
      <p className="text-3xl font-bold text-foreground">
        {props.price === 0 ? "Gratuit" : <>{formatGNF(props.price)} <span className="text-xs font-normal text-muted-foreground">GNF / mois</span></>}
      </p>
      <ul className="space-y-1.5 text-sm">
        {props.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-foreground">{f}</span>
          </li>
        ))}
      </ul>
      <Button onClick={props.onClick} disabled={props.disabled} className="w-full" variant={props.accent === "secondary" ? "outline" : "default"}>
        {props.loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {props.cta}
      </Button>
    </div>
  );
}