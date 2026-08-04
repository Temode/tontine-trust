import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Pricing = Database["public"]["Tables"]["sms_pricing"]["Row"];

interface Pack { id: string; qty: number; price: number; label?: string }

function toPacks(v: unknown): Pack[] {
  if (!Array.isArray(v)) return [];
  return v.map((p, i) => ({
    id: String((p as any)?.id ?? `pack_${i + 1}`),
    qty: Number((p as any)?.qty ?? 0),
    price: Number((p as any)?.price ?? 0),
    label: (p as any)?.label,
  }));
}

function fmtGnf(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " GNF";
}

export default function AdminSmsPricing() {
  const [rows, setRows] = useState<Pricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [unitPrice, setUnitPrice] = useState(150);
  const [packs, setPacks] = useState<Pack[]>([]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sms_pricing")
      .select("*")
      .order("effective_from", { ascending: false })
      .limit(20);
    if (error) toast.error("Chargement tarifs", { description: error.message });
    const list = data ?? [];
    setRows(list);
    const active = list.find((r) => r.is_active) ?? list[0];
    if (active) {
      setUnitPrice(active.unit_price);
      setPacks(toPacks(active.packs));
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const totalPacks = packs.length;
  const totalSaved = useMemo(
    () => packs.reduce((acc, p) => acc + Math.max(0, p.qty * unitPrice - p.price), 0),
    [packs, unitPrice],
  );

  const addPack = () => setPacks((p) => [...p, { id: `pack_${p.length + 1}`, qty: 100, price: 100 * unitPrice }]);
  const removePack = (i: number) => setPacks((p) => p.filter((_, idx) => idx !== i));
  const updatePack = (i: number, patch: Partial<Pack>) =>
    setPacks((p) => p.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const publish = async () => {
    if (unitPrice <= 0) { toast.error("Prix unitaire invalide"); return; }
    for (const p of packs) {
      if (p.qty <= 0 || p.price <= 0) { toast.error("Chaque pack doit avoir qty & prix > 0"); return; }
    }
    setPublishing(true);
    const { error } = await supabase.rpc("admin_publish_sms_pricing", {
      _unit_price: Math.round(unitPrice),
      _packs: packs as any,
    });
    setPublishing(false);
    if (error) {
      toast.error("Publication impossible", { description: error.message });
      return;
    }
    toast.success("Nouveau tarif publié");
    await load();
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h1 className="text-xl font-semibold text-amber-300">Tarification SMS</h1>
        <p className="text-sm text-slate-400 mt-1">
          Publier un nouveau tarif désactive l'ancien et crée une nouvelle ligne datée. Aucun historique n'est écrasé.
        </p>
      </header>

      <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-4">
        <h2 className="text-sm font-medium text-slate-100">Nouveau tarif</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-slate-400">Prix unitaire (GNF / SMS)</Label>
            <Input type="number" min={1} value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} className="bg-slate-950/40 border-slate-700 text-slate-100" />
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-3 text-xs text-slate-400 self-end">
            <div>Packs : <span className="text-slate-100">{totalPacks}</span></div>
            <div>Économies cumulées : <span className="text-emerald-300">{fmtGnf(totalSaved)}</span></div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-slate-400">Packs</Label>
            <Button size="sm" variant="outline" onClick={addPack} className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800">
              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un pack
            </Button>
          </div>
          <div className="space-y-2">
            {packs.map((p, i) => {
              const gross = p.qty * unitPrice;
              const savings = Math.max(0, gross - p.price);
              return (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end rounded border border-slate-800 bg-slate-950/40 p-2">
                  <div>
                    <Label className="text-[10px] uppercase text-slate-500">Code</Label>
                    <Input value={p.id} onChange={(e) => updatePack(i, { id: e.target.value })} className="h-8 bg-slate-950/40 border-slate-700 text-slate-100 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase text-slate-500">Qté SMS</Label>
                    <Input type="number" min={1} value={p.qty} onChange={(e) => updatePack(i, { qty: Number(e.target.value) })} className="h-8 bg-slate-950/40 border-slate-700 text-slate-100 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase text-slate-500">Prix (GNF)</Label>
                    <Input type="number" min={1} value={p.price} onChange={(e) => updatePack(i, { price: Number(e.target.value) })} className="h-8 bg-slate-950/40 border-slate-700 text-slate-100 text-xs" />
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Brut {fmtGnf(gross)}<br />
                    <span className="text-emerald-300">Économie {fmtGnf(savings)}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removePack(i)} className="text-red-400 hover:text-red-300">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            {packs.length === 0 && (
              <p className="text-xs text-slate-500">Aucun pack — seul le prix unitaire sera appliqué.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={publish} disabled={publishing} className="bg-amber-400 text-slate-900 hover:bg-amber-300">
            {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Publier ce tarif
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-sm font-medium text-slate-100 mb-3">Historique</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500 text-left">
              <tr>
                <th className="py-2 pr-3">Effectif</th>
                <th className="py-2 pr-3">Unitaire</th>
                <th className="py-2 pr-3">Packs</th>
                <th className="py-2">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((r) => (
                <tr key={r.id} className="text-slate-300">
                  <td className="py-2 pr-3 font-mono">{new Date(r.effective_from).toLocaleString("fr-FR")}</td>
                  <td className="py-2 pr-3">{fmtGnf(r.unit_price)}</td>
                  <td className="py-2 pr-3">{toPacks(r.packs).length}</td>
                  <td className="py-2">
                    {r.is_active ? (
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-300">actif</span>
                    ) : (
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-400">archivé</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}