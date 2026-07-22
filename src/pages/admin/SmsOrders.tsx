import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["sms_order_status"];
type Order = Database["public"]["Tables"]["sms_orders"]["Row"];

const STATUS_LABEL: Record<Status, string> = {
  pending: "En attente",
  paid: "Payée",
  credited: "Créditée",
  failed: "Échouée",
  cancelled: "Annulée",
};

const STATUS_TONE: Record<Status, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  paid: "bg-sky-500/15 text-sky-300",
  credited: "bg-emerald-500/15 text-emerald-300",
  failed: "bg-red-500/15 text-red-300",
  cancelled: "bg-slate-700 text-slate-300",
};

function fmtGnf(n: number) { return new Intl.NumberFormat("fr-FR").format(n) + " GNF"; }

export default function AdminSmsOrders() {
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [editing, setEditing] = useState<Order | null>(null);
  const [nextStatus, setNextStatus] = useState<Status>("credited");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("sms_orders").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast.error("Chargement commandes", { description: error.message });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [filter]);

  const openEdit = (o: Order) => {
    setEditing(o);
    setNextStatus(o.status === "pending" ? "credited" : o.status);
    setNote(o.admin_note ?? "");
  };

  const submit = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.rpc("admin_update_sms_order", {
      _order_id: editing.id,
      _status: nextStatus,
      _admin_note: note || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Mise à jour impossible", { description: error.message });
      return;
    }
    toast.success("Commande mise à jour");
    setEditing(null);
    await load();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-amber-300">Commandes SMS</h1>
          <p className="text-sm text-slate-400 mt-1">
            Suivre les achats de packs SMS, marquer manuellement une commande comme créditée ou annulée.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as Status | "all")}>
            <SelectTrigger className="w-40 bg-slate-950/40 border-slate-700 text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Rafraîchir
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
          Aucune commande pour ce filtre.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500 text-left">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Utilisateur</th>
                <th className="p-3">Pack</th>
                <th className="p-3">Qté</th>
                <th className="p-3">Montant</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Djomy</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((o) => (
                <tr key={o.id} className="text-slate-300">
                  <td className="p-3 font-mono whitespace-nowrap">{new Date(o.created_at).toLocaleString("fr-FR")}</td>
                  <td className="p-3 font-mono text-slate-400">{o.user_id.slice(0, 8)}…</td>
                  <td className="p-3">{o.pack_id ?? "—"}</td>
                  <td className="p-3">{o.qty}</td>
                  <td className="p-3">{fmtGnf(o.amount)}</td>
                  <td className="p-3">
                    <span className={`rounded px-2 py-0.5 ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                  </td>
                  <td className="p-3 font-mono text-[10px] text-slate-500">{o.djomy_ref ?? "—"}</td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={() => openEdit(o)} className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800">
                      Traiter
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>Mettre à jour la commande</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 text-sm">
              <div className="rounded border border-slate-800 bg-slate-950/40 p-3 text-xs space-y-1">
                <div><span className="text-slate-500">ID :</span> <span className="font-mono">{editing.id}</span></div>
                <div><span className="text-slate-500">Pack :</span> {editing.pack_id ?? "—"} · {editing.qty} SMS</div>
                <div><span className="text-slate-500">Montant :</span> {fmtGnf(editing.amount)}</div>
              </div>
              <div>
                <label className="text-xs text-slate-400">Nouveau statut</label>
                <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as Status)}>
                  <SelectTrigger className="bg-slate-950/40 border-slate-700 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Note interne</label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="bg-slate-950/40 border-slate-700 text-slate-100" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} className="text-slate-300">Annuler</Button>
            <Button onClick={submit} disabled={saving} className="bg-amber-400 text-slate-900 hover:bg-amber-300">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}