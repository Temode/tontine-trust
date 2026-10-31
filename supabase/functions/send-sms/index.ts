/**
 * send-sms — envoi générique d'un SMS via Nimba.
 *
 * Body JSON:
 *   { to: string | string[], body: string, senderName?: string }
 *
 * Auth: verify_jwt = true (utilisateur connecté requis).
 * Réponse: { success, messageId?, messageCost?, error? }.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sendMessage } from "../_shared/nimbasms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) return json({ error: "unauthorized" }, 401);

  let payload: { to?: unknown; body?: unknown; senderName?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const to = payload.to;
  const body = payload.body;
  const senderName =
    typeof payload.senderName === "string" ? payload.senderName : undefined;

  const recipients = Array.isArray(to)
    ? to.filter((x): x is string => typeof x === "string" && x.length > 0)
    : typeof to === "string" && to.length > 0
      ? [to]
      : [];

  if (recipients.length === 0) return json({ error: "to_required" }, 400);
  if (typeof body !== "string" || body.length === 0 || body.length > 665) {
    return json({ error: "body_invalid" }, 400);
  }

  const result = await sendMessage({
    to: recipients,
    body,
    senderName,
    logContext: {
      kind: "manual_admin_test",
      triggeredBy: userRes.user.id,
    },
  });
  return json(result, result.success ? 200 : 502);
});