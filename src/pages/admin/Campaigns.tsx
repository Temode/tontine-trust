import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Megaphone, RefreshCw, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listCampaigns, saveCampaign, saveCampaignContent,
  getMarketingSettings, updateMarketingSettings, listSends,
  type MarketingCampaign, type MarketingSettings, type MarketingSend,
} from "@/lib/api/marketing";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n || 0);
const card = "rounded-xl border border-slate-800 bg-slate-900/60 p-4";
const inputCls = "bg-slate-950 border-slate-800 text-slate-100";

function CampaignCard({ c, onSaved }: { c: MarketingCampaign; onSaved: () => void }) {
  const [draft, setDraft] = useState(c);
  const [sms, setSms] = useState(c.contents?.sms?.body ?? "");
  const [emailSubject, setEmailSubject] = useState(c.contents?.email?.subject ?? "");
  const [emailBody, setEmailBody] = useState(c.contents?.email?.body ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(c);
    setSms(c.contents?.sms?.body ?? "");
    setEmailSubject(c.contents?.email?.subject ?? "");
    setEmailBody(c.contents?.email?.body ?? "");
  }, [c]);

  const save = async () => {
    setBusy(true);
    try {
      await saveCampaign(draft);
      if (sms.trim()) await saveCampaignContent(draft.code, "sms", null, sms.trim());
      if (emailBody.trim()) await saveCampaignContent(draft.code, "email", emailSubject.trim() || null, emailBody.trim());
      toast.success("Campagne enregistrée");
      onSaved();
    } catch (e) {
      toast.error("Enregistrement impossible", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white">{draft.label}</h3>
            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">{draft.code}</Badge>
            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">{draft.segment}</Badge>
          </div>
          {draft.description && <p className="text-sm text-slate-400 mt-1">{draft.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-slate-400">Active</Label>
          <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <div>
          <Label className="text-xs text-slate-400">Max par période</Label>
          <Input className={inputCls} type="number" value={draft.per_user_cap}
            onChange={(e) => setDraft({ ...draft, per_user_cap: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs text-slate-400">Période (jours)</Label>
          <Input className={inputCls} type="number" value={draft.cap_period_days}
            onChange={(e) => setDraft({ ...draft, cap_period_days: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs text-slate-400">Répétition (jours)</Label>
          <Input className={inputCls} type="number" value={draft.repeat_days}
            onChange={(e) => setDraft({ ...draft, repeat_days: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs text-slate-400">Priorité</Label>
          <Input className={inputCls} type="number" value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 mt-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <Switch checked={draft.sms_enabled} onCheckedChange={(v) => setDraft({ ...draft, sms_enabled: v })} /> SMS
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <Switch checked={draft.email_enabled} onCheckedChange={(v) => setDraft({ ...draft, email_enabled: v })} /> Email
        </label>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div>
          <Label className="text-xs text-slate-400">Texte SMS ({sms.length} car.)</Label>
          <Textarea className={inputCls} rows={4} value={sms} onChange={(e) => setSms(e.target.value)}
            placeholder="Bonjour {{prenom}}, ..." />
          <p className="text-[11px] text-slate-500 mt-1">Variables : {"{{prenom}}"}, {"{{groupe}}"}, {"{{solde}}"}</p>
        </div>
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-slate-400">Objet email</Label>
            <Input className={inputCls} value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Corps email</Label>
            <Textarea className={inputCls} rows={4} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800">
        <div className="text-xs text-slate-400 flex flex-wrap gap-3">
          <span>Envois : <b className="text-slate-200">{c.stats?.sent ?? 0}</b></span>
          <span>SMS : {c.stats?.sms ?? 0}</span>
          <span>Emails : {c.stats?.email ?? 0}</span>
          <span>Clics : {c.stats?.clicks ?? 0}</span>
          <span>Conversions : <b className="text-emerald-400">{c.stats?.conversions ?? 0}</b></span>
          <span>Coût : {fmt(c.stats?.cost ?? 0)} GNF</span>
        </div>
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
        </Button>
      </div>
    </div>
  );
}

export default function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [settings, setSettings] = useState<MarketingSettings | null>(null);
  const [sends, setSends] = useState<MarketingSend[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s, l] = await Promise.all([listCampaigns(), getMarketingSettings(), listSends(null, null, 100)]);
      setCampaigns(c); setSettings(s); setSends(l);
    } catch (e) {
      toast.error("Chargement impossible", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => campaigns.reduce(
    (a, c) => ({
      sent: a.sent + (c.stats?.sent ?? 0),
      conv: a.conv + (c.stats?.conversions ?? 0),
      cost: a.cost + (c.stats?.cost ?? 0),
    }), { sent: 0, conv: 0, cost: 0 }), [campaigns]);

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      await updateMarketingSettings(settings);
      toast.success("Réglages enregistrés");
      await load();
    } catch (e) {
      toast.error("Enregistrement impossible", { description: (e as Error).message });
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-white">
          <Megaphone className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold">Campagnes SMS &amp; Email</h2>
        </div>
        <Button variant="outline" size="sm" className="bg-transparent border-slate-700 text-slate-200" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" /> Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={card}><div className="text-xs text-slate-400">Campagnes actives</div><div className="text-2xl font-bold text-white">{campaigns.filter((c) => c.is_active).length}</div></div>
        <div className={card}><div className="text-xs text-slate-400">Messages envoyés</div><div className="text-2xl font-bold text-white">{totals.sent}</div></div>
        <div className={card}><div className="text-xs text-slate-400">Conversions</div><div className="text-2xl font-bold text-emerald-400">{totals.conv}</div></div>
        <div className={card}><div className="text-xs text-slate-400">Coût SMS cumulé</div><div className="text-2xl font-bold text-amber-400">{fmt(totals.cost)} GNF</div></div>
      </div>

      {settings && !settings.global_enabled && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          Le moteur de campagnes est désactivé : aucun message marketing n'est envoyé.
        </div>
      )}

      <Tabs defaultValue="campaigns">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="campaigns">Campagnes</TabsTrigger>
          <TabsTrigger value="settings">Réglages</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4 mt-4">
          {campaigns.length === 0 && <p className="text-sm text-slate-400">Aucune campagne configurée.</p>}
          {campaigns.map((c) => <CampaignCard key={c.code} c={c} onSaved={load} />)}
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          {settings && (
            <div className={card}>
              <div className="flex items-center gap-2 mb-4 text-white">
                <Settings2 className="h-4 w-4 text-amber-400" /> <span className="font-semibold">Réglages globaux</span>
              </div>
              <label className="flex items-center gap-3 mb-4 text-sm text-slate-300">
                <Switch checked={settings.global_enabled} onCheckedChange={(v) => setSettings({ ...settings, global_enabled: v })} />
                Moteur de campagnes activé (interrupteur d'urgence)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><Label className="text-xs text-slate-400">Coût unitaire SMS (GNF)</Label>
                  <Input className={inputCls} type="number" value={settings.sms_unit_cost_gnf}
                    onChange={(e) => setSettings({ ...settings, sms_unit_cost_gnf: Number(e.target.value) })} /></div>
                <div><Label className="text-xs text-slate-400">Budget / jour (GNF)</Label>
                  <Input className={inputCls} type="number" value={settings.daily_budget_gnf}
                    onChange={(e) => setSettings({ ...settings, daily_budget_gnf: Number(e.target.value) })} /></div>
                <div><Label className="text-xs text-slate-400">Budget / mois (GNF)</Label>
                  <Input className={inputCls} type="number" value={settings.monthly_budget_gnf}
                    onChange={(e) => setSettings({ ...settings, monthly_budget_gnf: Number(e.target.value) })} /></div>
                <div><Label className="text-xs text-slate-400">Début heures autorisées</Label>
                  <Input className={inputCls} type="number" min={0} max={23} value={settings.quiet_start_hour}
                    onChange={(e) => setSettings({ ...settings, quiet_start_hour: Number(e.target.value) })} /></div>
                <div><Label className="text-xs text-slate-400">Fin heures autorisées</Label>
                  <Input className={inputCls} type="number" min={0} max={23} value={settings.quiet_end_hour}
                    onChange={(e) => setSettings({ ...settings, quiet_end_hour: Number(e.target.value) })} /></div>
                <div><Label className="text-xs text-slate-400">Max SMS / utilisateur / 30j</Label>
                  <Input className={inputCls} type="number" value={settings.max_sms_per_user_30d}
                    onChange={(e) => setSettings({ ...settings, max_sms_per_user_30d: Number(e.target.value) })} /></div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800">
                <div className="text-xs text-slate-400">
                  Dépensé aujourd'hui : <b className="text-slate-200">{fmt(settings.spent_today)} GNF</b> ·
                  ce mois : <b className="text-slate-200">{fmt(settings.spent_month)} GNF</b>
                </div>
                <Button size="sm" onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="journal" className="mt-4">
          <div className={card + " overflow-x-auto"}>
            <table className="w-full text-sm">
              <thead className="text-slate-400 text-xs uppercase">
                <tr className="text-left">
                  <th className="py-2 pr-3">Date</th><th className="pr-3">Campagne</th><th className="pr-3">Canal</th>
                  <th className="pr-3">Destinataire</th><th className="pr-3">Statut</th><th className="pr-3">Coût</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {sends.map((s) => (
                  <tr key={s.id} className="border-t border-slate-800">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(s.created_at).toLocaleString("fr-FR")}</td>
                    <td className="pr-3">{s.campaign_code}</td>
                    <td className="pr-3 uppercase text-xs">{s.channel}</td>
                    <td className="pr-3">{s.full_name ?? s.user_id.slice(0, 8)}</td>
                    <td className="pr-3">
                      <Badge variant="outline" className={s.converted_at
                        ? "border-emerald-500/40 text-emerald-300"
                        : "border-slate-700 text-slate-300"}>
                        {s.converted_at ? "converti" : s.status}
                      </Badge>
                    </td>
                    <td className="pr-3">{fmt(s.cost_gnf)} GNF</td>
                  </tr>
                ))}
                {sends.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-400">Aucun envoi pour le moment.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
