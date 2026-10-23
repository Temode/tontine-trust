import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type PlanCode = Database["public"]["Enums"]["subscription_plan_code"];
type Plan = Database["public"]["Tables"]["subscription_plans"]["Row"];
type PlanHistory = Database["public"]["Tables"]["subscription_plan_history"]["Row"];

function fmtGnf(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " GNF";
}

function PlanCard({ plan, onSaved }: { plan: Plan; onSaved: () => void }) {
  const [label, setLabel] = useState(plan.label);
  const [basePrice, setBasePrice] = useState<number>(plan.base_price);
  const [smsIncluded, setSmsIncluded] = useState<number>(plan.sms_included);
  const [isActive, setIsActive] = useState<boolean>(plan.is_active);
  const [limits, setLimits] = useState<string>(JSON.stringify(plan.limits, null, 2));
  const [tiers, setTiers] = useState<string>(JSON.stringify(plan.tiers, null, 2));
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => {
    try {
      return { limits: JSON.parse(limits), tiers: JSON.parse(tiers), ok: true as const };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [limits, tiers]);

  const save = async () => {
    if (!parsed.ok) {
      toast.error("JSON invalide", { description: parsed.error });
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("admin_update_subscription_plan", {
      _code: plan.code,
      _label: label,
      _base_price: Math.max(0, Math.round(basePrice)),
      _sms_included: Math.max(0, Math.round(smsIncluded)),
      _limits: parsed.limits,
      _tiers: parsed.tiers,
      _is_active: isActive,
    });
    setSaving(false);
    if (error) {
      toast.error("Impossible de sauvegarder", { description: error.message });
      return;
    }
    toast.success(`Plan ${plan.code} mis à jour`);
    onSaved();
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Plan {plan.code}</div>
          <h3 className="text-lg font-semibold text-amber-300">{plan.label}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} id={`active-${plan.code}`} />
          <Label htmlFor={`active-${plan.code}`} className="text-xs text-slate-300">Actif</Label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs text-slate-400">Libellé public</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} className="bg-slate-950/40 border-slate-700 text-slate-100" />
        </div>
        <div>
          <Label className="text-xs text-slate-400">Prix mensuel (GNF)</Label>
          <Input type="number" min={0} value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} className="bg-slate-950/40 border-slate-700 text-slate-100" />
          <p className="mt-1 text-[11px] text-slate-500">{fmtGnf(basePrice || 0)}</p>
        </div>
        <div>
          <Label className="text-xs text-slate-400">SMS inclus / mois</Label>
          <Input type="number" min={0} value={smsIncluded} onChange={(e) => setSmsIncluded(Number(e.target.value))} className="bg-slate-950/40 border-slate-700 text-slate-100" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-slate-400">Limites (JSON)</Label>
          <Textarea rows={8} value={limits} onChange={(e) => setLimits(e.target.value)} className="font-mono text-xs bg-slate-950/40 border-slate-700 text-slate-100" />
          <p className="mt-1 text-[11px] text-slate-500">ex: {"{"} "max_groups": 2, "max_members_per_group": 8, "solo": 0, "international": 0 {"}"}</p>
        </div>
        <div>
          <Label className="text-xs text-slate-400">Paliers Premium (JSON)</Label>
          <Textarea rows={8} value={tiers} onChange={(e) => setTiers(e.target.value)} className="font-mono text-xs bg-slate-950/40 border-slate-700 text-slate-100" />
          <p className="mt-1 text-[11px] text-slate-500">Format libre — utilisé pour calculer le prix modulable côté /abonnement.</p>
        </div>
      </div>

      {!parsed.ok && <p className="text-xs text-red-400">JSON invalide : {parsed.error}</p>}

      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>Mis à jour {new Date(plan.updated_at).toLocaleString("fr-FR")}</span>
        <Button onClick={save} disabled={saving || !parsed.ok} className="bg-amber-400 text-slate-900 hover:bg-amber-300">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

export default function AdminSubscriptions() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [history, setHistory] = useState<PlanHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: p, error: pe }, { data: h }] = await Promise.all([
      supabase.from("subscription_plans").select("*").order("base_price", { ascending: true }),
      supabase.from("subscription_plan_history").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    if (pe) toast.error("Chargement plans", { description: pe.message });
    setPlans(p ?? []);
    setHistory(h ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-xl font-semibold text-amber-300">Plans d'abonnement</h1>
        <p className="text-sm text-slate-400 mt-1">
          Prix, limites et paliers Premium modifiables sans déploiement. Chaque enregistrement crée une entrée d'historique.
        </p>
      </header>

      <div className="space-y-4">
        {(plans ?? []).map((plan) => (
          <PlanCard key={plan.code as PlanCode} plan={plan} onSaved={load} />
        ))}
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium text-slate-100">
          <History className="h-4 w-4" /> Historique des modifications
        </h2>
        {history.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Aucune modification enregistrée.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs">
            {history.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-3 rounded border border-slate-800 bg-slate-950/40 p-2">
                <div>
                  <div className="font-mono text-amber-300">{h.plan_code}</div>
                  <div className="text-slate-500">{new Date(h.created_at).toLocaleString("fr-FR")}</div>
                </div>
                <details className="flex-1">
                  <summary className="cursor-pointer text-slate-400">Snapshot</summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-950/60 p-2 text-[10px] text-slate-300">
{JSON.stringify(h.snapshot, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}