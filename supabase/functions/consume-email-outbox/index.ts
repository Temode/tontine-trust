/**
 * consume-email-outbox — worker FIFO pour public.email_outbox.
 * Appelé toutes les minutes par pg_cron. verify_jwt = false (cron interne).
 * Envoie via la passerelle Resend, rate-limit 200 emails/min.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "Tontine Digitale <noreply@tontinedigitale.com>";
const REPLY_TO = "support@tontinedigitale.com";
const RATE_LIMIT_PER_MIN = 200;
const BATCH_SIZE = 25;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "email_not_configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Verrou consultatif global (évite double consommation si cron déclenche 2×)
  const { data: locked } = await admin.rpc("email_outbox_try_lock");
  if (!locked) {
    return new Response(JSON.stringify({ skipped: "locked" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const summary = { processed: 0, sent: 0, failed: 0, skipped_rate: 0 };
  try {
    const { data: sentLastMin } = await admin.rpc("email_outbox_recent_sent_count", { _minutes: 1 });
    const remaining = Math.max(0, RATE_LIMIT_PER_MIN - (sentLastMin ?? 0));
    const limit = Math.min(BATCH_SIZE, remaining);
    if (limit === 0) {
      summary.skipped_rate = 1;
    } else {
      const { data: rows, error } = await admin.rpc("email_outbox_pop", { _limit: limit });
      if (error) throw error;
      for (const row of rows ?? []) {
        summary.processed++;
        const p = row.payload ?? {};
        try {
          const resp = await fetch(`${GATEWAY_URL}/emails`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": RESEND_API_KEY,
            },
            body: JSON.stringify({
              from: FROM,
              to: Array.isArray(p.to) ? p.to : [p.to],
              subject: p.subject,
              html: p.html,
              text: p.text,
              reply_to: p.replyTo ?? REPLY_TO,
            }),
          });
          const body = await resp.text();
          if (resp.ok) {
            await admin.rpc("email_outbox_mark", { _id: row.id, _status: "sent", _error: null });
            summary.sent++;
          } else {
            console.error(`gateway ${resp.status}: ${body}`);
            await admin.rpc("email_outbox_mark", {
              _id: row.id,
              _status: row.attempts >= 3 ? "failed" : "queued",
              _error: `${resp.status}:${body.slice(0, 300)}`,
            });
            summary.failed++;
          }
        } catch (e) {
          const msg = (e as Error).message ?? String(e);
          console.error("send error:", msg);
          await admin.rpc("email_outbox_mark", {
            _id: row.id,
            _status: row.attempts >= 3 ? "failed" : "queued",
            _error: msg.slice(0, 300),
          });
          summary.failed++;
        }
      }
    }
  } finally {
    await admin.rpc("email_outbox_unlock");
  }

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
