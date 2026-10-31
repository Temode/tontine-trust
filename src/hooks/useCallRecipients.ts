import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RecipientRow, RecipientStatus } from "@/lib/callRecipients";

/** Destinataires d'un appel, tenus à jour en temps réel. */
export function useCallRecipients(callId: string | null | undefined): RecipientRow[] {
  const [rows, setRows] = useState<RecipientRow[]>([]);

  useEffect(() => {
    if (!callId || callId.startsWith("e2e-stub")) return;
    let cancelled = false;
    const names = new Map<string, string | null>();

    const load = async () => {
      const { data } = await supabase
        .from("call_recipients")
        .select("user_id, status")
        .eq("call_id", callId);
      if (cancelled || !data) return;
      const missing = data.map((r) => r.user_id).filter((id) => !names.has(id));
      if (missing.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", missing);
        for (const id of missing) names.set(id, null);
        for (const p of profs ?? []) {
          const n = (p.full_name ?? "").trim();
          names.set(p.id, n && !n.includes("@") ? n : null);
        }
      }
      if (cancelled) return;
      setRows(data.map((r) => ({
        user_id: r.user_id,
        status: r.status as RecipientStatus,
        name: names.get(r.user_id) ?? null,
      })));
    };

    void load();
    const channel = supabase
      .channel(`call-recipients:${callId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "call_recipients", filter: `call_id=eq.${callId}` }, () => void load())
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [callId]);

  return callId ? rows : [];
}
