import { useMemo, useState } from "react";
import { Loader2, MessageSquare, Phone, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeGNPhone, formatGNPhone } from "@/lib/phone";
import { toast } from "sonner";

const DEFAULT_BODY = "Tontine: ceci est un SMS de test envoyé depuis le back-office.";

export default function AdminSmsTest() {
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState(DEFAULT_BODY);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<
    | null
    | { ok: true; messageId?: string; cost?: number }
    | { ok: false; error: string }
  >(null);

  const normalized = useMemo(() => normalizeGNPhone(phone), [phone]);
  const pretty = useMemo(() => formatGNPhone(phone), [phone]);
  const charCount = body.length;
  const segments = Math.max(1, Math.ceil(charCount / 160));

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    if (!normalized) {
      toast.error("Numéro invalide", { description: "Format attendu : +224 6XX XX XX XX" });
      return;
    }
    if (body.length === 0 || body.length > 665) {
      toast.error("Message invalide", { description: "Entre 1 et 665 caractères." });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: { to: normalized, body },
      });
      if (error) throw error;
      if (data?.success) {
        setResult({ ok: true, messageId: data.messageId, cost: data.messageCost });
        toast.success("SMS envoyé");
      } else {
        setResult({ ok: false, error: data?.error ?? "Erreur inconnue" });
        toast.error("Échec d'envoi", { description: data?.error });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ ok: false, error: msg });
      toast.error("Échec d'envoi", { description: msg });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold text-white">Test SMS Nimba</h1>
        <p className="text-sm text-slate-400 mt-1">
          Déclenche manuellement un envoi via la fonction <code className="text-amber-300">send-sms</code>.
          Chaque tentative est journalisée dans <code className="text-amber-300">sms_logs</code>.
        </p>
      </header>

      <form onSubmit={handleSend} className="rounded-lg border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
            Numéro destinataire
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+224 620 90 00 01 ou 620900001"
              className="w-full bg-slate-950 border border-slate-700 rounded-md pl-10 pr-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            {phone.length === 0 ? (
              <span className="text-slate-500">Format guinéen attendu (9 chiffres commençant par 6).</span>
            ) : normalized ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-300">
                  Normalisé : <span className="font-mono">{normalized}</span> ({pretty})
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                <span className="text-red-300">Numéro non valide</span>
              </>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={665}
            className="w-full bg-slate-950 border border-slate-700 rounded-md p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <div className="mt-1 text-xs text-slate-500 flex justify-between">
            <span>
              {charCount} caractères · {segments} segment{segments > 1 ? "s" : ""} SMS
            </span>
            <span>Max 665 (5 segments)</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={sending || !normalized}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-400 text-slate-900 font-medium hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
          Envoyer le SMS
        </button>
      </form>

      {result &&
        (result.ok ? (
          <div className="rounded-lg border p-4 border-emerald-500/30 bg-emerald-500/5 text-emerald-200">
            <p className="font-medium">SMS envoyé avec succès</p>
            <p className="text-xs mt-1 opacity-80">
              ID : {result.messageId ?? "—"} · Coût : {result.cost ?? "—"} segment(s)
            </p>
          </div>
        ) : (
          <div className="rounded-lg border p-4 border-red-500/30 bg-red-500/5 text-red-200">
            <p className="font-medium">Échec</p>
            <p className="text-xs mt-1 opacity-80">{result.error}</p>
          </div>
        ))}
    </div>
  );
}