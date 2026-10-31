import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { verifyCallToken } from "../_shared/callToken.ts";

// Réponse de l'écran natif, sans session : téléphone verrouillé, page web à l'arrêt.
// Authentifiée uniquement par le jeton signé reçu dans la notification d'appel.
const ACTIONS = new Set(["delivered", "declined", "accepted"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const secret = Deno.env.get("CALL_RESPONSE_SECRET");
  if (!secret) return json({ error: "not_configured" }, 500);

  const body = await req.json().catch(() => null) as { token?: unknown; action?: unknown } | null;
  const token = typeof body?.token === "string" && body.token.length < 1024 ? body.token : null;
  const action = typeof body?.action === "string" && ACTIONS.has(body.action) ? body.action : null;
  if (!token || !action) return json({ error: "invalid_body" }, 400);

  const claims = await verifyCallToken(secret, token);
  if (!claims) return json({ error: "invalid_token" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb.rpc("_call_recipient_set", {
    p_call_id: claims.callId, p_user_id: claims.userId, p_status: action,
  });
  if (error) return json({ error: error.message }, 409);
  return json({ ok: true, status: data });
});
