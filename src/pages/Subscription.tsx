import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Crown, Sparkles, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TopBar } from "@/components/layout/TopBar";
import { formatGNF } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlements } from "@/hooks/useEntitlements";
import type { Database } from "@/integrations/supabase/types";

type Plan = Database["public"]["Tables"]["subscription_plans"]["Row"];
type PlanCode = Plan["code"];

export default function Subscription() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { entitlements, refetch } = useEntitlements();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PlanCode | null>(null);

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

  const goToCheckout = (planCode: "premium" | "business") => {
    if (!user) { nav("/auth"); return; }
    nav(`/abonnement/checkout?plan=${planCode}`);
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
  const premiumTiers = (premiumPlan?.tiers as any) ?? {};
  const premiumMinPrice = Number(premiumTiers.min_price ?? premiumPlan?.base_price ?? 0);

  const maxGroups = entitlements.limits.max_groups;
  const maxMembers = entitlements.limits.max_members_per_group;
  const groupsUsed = entitlements.usage.groups;
  const membersUsed = entitlements.usage.max_members_in_group;
  const groupsRemaining = maxGroups === -1 ? Infinity : Math.max(0, maxGroups - groupsUsed);
  const membersRemaining = maxMembers === -1 ? Infinity : Math.max(0, maxMembers - membersUsed);
  const groupsPct = maxGroups === -1 ? 0 : Math.min(100, Math.round((groupsUsed / Math.max(maxGroups, 1)) * 100));
  const membersPct = maxMembers === -1 ? 0 : Math.min(100, Math.round((membersUsed / Math.max(maxMembers, 1)) * 100));
  const needsUpgrade =
    (maxGroups !== -1 && groupsUsed >= maxGroups) ||
    (maxMembers !== -1 && membersUsed >= maxMembers);
  const nearLimit =
    !needsUpgrade &&
    ((maxGroups !== -1 && groupsPct >= 80) || (maxMembers !== -1 && membersPct >= 80));

  return (
    <div className="animate-fade-in">
      <TopBar title="Abonnement" subtitle="Choisissez le plan adapté à vos tontines" />
      <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8 lg:py-10 space-y-8">
        {entitlements.read_only && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
            Votre abonnement est expiré ou en défaut de paiement — l'application est en <strong>mode lecture seule</strong>. Choisissez un plan pour réactiver vos groupes.
          </div>
        )}

        {/* Usage & upgrade hint */}
        <section
          data-testid="entitlements-usage"
          className={`rounded-lg border p-4 lg:p-5 ${
            needsUpgrade
              ? "border-destructive/40 bg-destructive/5"
              : nearLimit
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-hairline bg-card"
          }`}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">Groupes</span>
                <span className="font-mono text-muted-foreground" data-testid="quota-groups">
                  {groupsUsed} / {maxGroups === -1 ? "∞" : maxGroups}
                </span>
              </div>
              {maxGroups !== -1 && <Progress value={groupsPct} className="mt-2 h-2" />}
              <p className="mt-1 text-xs text-muted-foreground">
                {maxGroups === -1
                  ? "Illimité avec votre plan actuel."
                  : groupsRemaining === 0
                    ? "Quota atteint — upgrade requis pour créer un nouveau groupe."
                    : `${groupsRemaining} groupe${groupsRemaining > 1 ? "s" : ""} restant${groupsRemaining > 1 ? "s" : ""}.`}
              </p>
            </div>
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">Membres (plus grand groupe)</span>
                <span className="font-mono text-muted-foreground" data-testid="quota-members">
                  {membersUsed} / {maxMembers === -1 ? "∞" : maxMembers}
                </span>
              </div>
              {maxMembers !== -1 && <Progress value={membersPct} className="mt-2 h-2" />}
              <p className="mt-1 text-xs text-muted-foreground">
                {maxMembers === -1
                  ? "Illimité avec votre plan actuel."
                  : membersRemaining === 0
                    ? "Quota atteint — upgrade requis pour ajouter un membre supplémentaire."
                    : `${membersRemaining} membre${membersRemaining > 1 ? "s" : ""} restant${membersRemaining > 1 ? "s" : ""} par groupe.`}
                {" "}Total actifs : <strong>{entitlements.usage.members_total}</strong>.
              </p>
            </div>
          </div>
          {(needsUpgrade || nearLimit) && (
            <p
              data-testid="upgrade-hint"
              className={`mt-3 text-sm font-medium ${needsUpgrade ? "text-destructive" : "text-amber-700 dark:text-amber-300"}`}
            >
              {needsUpgrade
                ? "Vous avez atteint la limite de votre plan. Passez au Premium ou Business pour continuer à créer des groupes et ajouter des membres."
                : "Vous approchez de la limite de votre plan — pensez à passer à un plan supérieur avant d'être bloqué."}
            </p>
          )}
        </section>

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
            <PlanCard
              title={premiumPlan.label}
              subtitle="Modulez vos quotas selon vos besoins"
              price={premiumMinPrice}
              priceSuffix="À partir de"
              accent="primary"
              current={currentPlan === "premium"}
              icon={<Sparkles className="h-4 w-4 text-primary" />}
              features={[
                "Quotas modulables (groupes, membres, SMS…)",
                `${premiumPlan.sms_included} SMS/mois inclus (base)`,
                "Notifications SMS + e-mail + in-app",
                "Support prioritaire",
              ]}
              cta={currentPlan === "premium" ? "Ajuster mon plan" : "Configurer & payer"}
              disabled={busy !== null}
              onClick={() => goToCheckout("premium")}
            />
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
              onClick={() => goToCheckout("business")}
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
  priceSuffix?: string;
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
      <div>
        {props.priceSuffix && props.price > 0 && (
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{props.priceSuffix}</p>
        )}
        <p className="text-3xl font-bold text-foreground">
          {props.price === 0 ? "Gratuit" : <>{formatGNF(props.price)} <span className="text-xs font-normal text-muted-foreground">GNF / mois</span></>}
        </p>
      </div>
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