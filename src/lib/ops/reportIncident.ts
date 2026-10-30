/**
 * Remontée d'incident applicatif vers l'équipe (email / SMS / webhook).
 * Fire-and-forget : ne doit jamais casser le rendu ni boucler sur lui-même.
 */
import { supabase } from "@/integrations/supabase/client";

const sent = new Map<string, number>();
const WINDOW_MS = 10 * 60 * 1000;

export async function reportIncident(
  code: string,
  message: string,
  context: Record<string, unknown> = {},
  severity: "info" | "warning" | "critical" = "warning",
): Promise<void> {
  try {
    const key = `${code}:${message.slice(0, 120)}`;
    const now = Date.now();
    const last = sent.get(key);
    if (last && now - last < WINDOW_MS) return;
    sent.set(key, now);

    await supabase.rpc("report_client_incident" as never, {
      _code: code,
      _message: message.slice(0, 500),
      _context: context,
      _severity: severity,
    } as never);
  } catch {
    /* silencieux : la remontée d'incident ne doit jamais lever */
  }
}
