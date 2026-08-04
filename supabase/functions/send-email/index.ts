/**
 * send-email — envoi générique via Resend (gateway Lovable).
 *
 * Body JSON: { to, subject, html, text?, replyTo? }
 *          | { to, kind, vars }        // rendu via emailTemplates.ts
 *
 * Auth: nécessite un utilisateur connecté (Bearer JWT).
 * Réponse: { success, id?, error? }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { renderEmail, EMAIL_FROM, EMAIL_REPLY_TO, type EmailKind } from "../_shared/emailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) return json({ error: "unauthorized" }, 401);

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) return json({ error: "email_not_configured" }, 500);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const to = payload.to;
  const recipients = Array.isArray(to)
    ? to.filter((x): x is string => typeof x === "string" && /.+@.+\..+/.test(x))
    : typeof to === "string" && /.+@.+\..+/.test(to) ? [to] : [];
  if (recipients.length === 0) return json({ error: "to_required" }, 400);

  let subject: string, html: string, text: string | undefined;
  if (typeof payload.kind === "string") {
    try {
      const rendered = renderEmail(payload.kind as EmailKind, (payload.vars ?? {}) as Record<string, unknown>);
      subject = rendered.subject; html = rendered.html; text = rendered.text;
    } catch (e) { return json({ error: `render_failed:${(e as Error).message}` }, 400); }
  } else {
    if (typeof payload.subject !== "string" || typeof payload.html !== "string") {
      return json({ error: "subject_and_html_required" }, 400);
    }
    subject = payload.subject; html = payload.html;
    text = typeof payload.text === "string" ? payload.text : undefined;
  }

  const replyTo = typeof payload.replyTo === "string" ? payload.replyTo : EMAIL_REPLY_TO;

  const resp = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: recipients, subject, html, text, reply_to: replyTo }),
  });

  const body = await resp.text();
  if (!resp.ok) {
    console.error(`send-email gateway ${resp.status}: ${body}`);
    return json({ success: false, error: "gateway_failed", status: resp.status, details: body }, resp.status);
  }
  let parsed: { id?: string } = {};
  try { parsed = JSON.parse(body); } catch { /* Resend renvoie du JSON, mais soyons tolérants */ }
  return json({ success: true, id: parsed.id ?? null });
});
