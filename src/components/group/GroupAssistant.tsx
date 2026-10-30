import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Send, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { canUseAssistant } from "@/lib/assistantAccess";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Quand est mon tour ?",
  "Combien me reste-t-il à payer ?",
  "Ai-je des pénalités ?",
  "Que se passe-t-il si je paie en retard ?",
];

export function GroupAssistant({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const { entitlements, isLoading: entLoading } = useEntitlements();
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const allowed = canUseAssistant(entitlements.plan_code, entitlements.status);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const histQ = useQuery({
    queryKey: ["assistant", groupId, user?.id],
    enabled: !!user && allowed,
    queryFn: async (): Promise<Msg[]> => {
      const { data, error } = await supabase
        .from("group_assistant_messages")
        .select("id, role, content")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  const messages = [...(histQ.data ?? []), ...pending];
  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [messages.length, pending]);
  useEffect(() => taRef.current?.focus(), [busy]);

  if (entLoading) return null;
  if (!allowed) {
    return (
      <div className="rounded-xl border border-hairline bg-card p-6 text-center">
        <Lock className="mx-auto h-6 w-6 text-primary" />
        <h3 className="mt-3 font-semibold text-foreground">Le Conseiller Tontine est réservé à Premium</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Posez vos questions sur vos tours, cotisations et pénalités, et obtenez une réponse immédiate.
        </p>
        <Button asChild className="mt-4"><Link to="/abonnement">Passer à Premium</Link></Button>
      </div>
    );
  }

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy || !online) return;
    setErr(null);
    setInput("");
    setBusy(true);
    const a: Msg = { id: "a-tmp", role: "assistant", content: "" };
    setPending([{ id: "u-tmp", role: "user", content: question }, a]);
    try {
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tontine-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${s.session?.access_token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ group_id: groupId, question }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Le conseiller est indisponible pour le moment.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setPending((p) => [p[0], { ...p[1], content: text }]);
      }
      if (!text.trim()) throw new Error("Le conseiller n'a pas pu répondre. Réessayez dans un instant.");
      await qc.invalidateQueries({ queryKey: ["assistant", groupId, user?.id] });
      setPending([]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
      setPending((p) => p.slice(0, 1));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[min(70vh,640px)] flex-col overflow-hidden rounded-xl border border-hairline bg-card">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <Logo size={28} />
        <div>
          <p className="text-sm font-semibold text-foreground">Conseiller Tontine</p>
          <p className="text-xs text-muted-foreground">Répond à partir des règles du groupe et de vos cotisations</p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" disabled={!online}
                onClick={() => ask(s)}
                className="rounded-full border border-hairline bg-secondary px-3 py-1.5 text-xs text-foreground transition hover:border-primary disabled:opacity-50">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed",
              m.role === "user" ? "rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-primary-foreground" : "text-foreground")}>
              {m.content || <span className="inline-flex gap-1 text-muted-foreground">Réflexion<span className="animate-pulse">…</span></span>}
            </div>
          </div>
        ))}
        {err && <p className="text-sm text-destructive">{err}</p>}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(input); }}
        className="flex items-end gap-2 border-t border-hairline p-3">
        {!online && <WifiOff className="mb-2.5 h-4 w-4 shrink-0 text-muted-foreground" />}
        <textarea ref={taRef} rows={1} value={input} maxLength={1000} disabled={!online}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
          placeholder={online ? "Posez votre question…" : "Connexion Internet nécessaire"}
          aria-label="Question au conseiller"
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-hairline bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <Button type="submit" size="icon" disabled={busy || !online || !input.trim()} aria-label="Envoyer">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
