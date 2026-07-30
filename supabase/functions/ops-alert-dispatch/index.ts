/**
 * ops-alert-dispatch — pousse les alertes d'exploitation vers les webhooks configurés.
 * Consomme public.ops_alerts (webhook_status = 'queued') via RPC service_role.
 * Appelé par pg_cron (chaque minute) et par le bouton « Tester » de l'admin.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: recipients } = await admin
    .from("ops_alert_recipients")
    .select("target")
    .eq("channel", "webhook")
    .eq("enabled", true);

  const hooks = (recipients ?? []).map((r: { target: string }) => r.target);

  const { data: rows, error } = await admin.rpc("ops_alert_webhook_pop", { _limit: 20 });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const summary = { processed: 0, sent: 0, failed: 0, hooks: hooks.length };

  for (const row of rows ?? []) {
    summary.processed++;
    if (hooks.length === 0) {
      await admin.rpc("ops_alert_webhook_mark", { _id: row.id, _status: "skipped", _error: null });
      continue;
    }
    const errors: string[] = [];
    for (const hook of hooks) {
      try {
        const resp = await fetch(hook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "tontine-digitale",
            alert_id: row.id,
            code: row.code,
            severity: row.severity,
            message: row.message,
            context: row.context,
            created_at: row.created_at,
          }),
        });
        if (!resp.ok) errors.push(`${hook}:${resp.status}`);
      } catch (e) {
        errors.push(`${hook}:${(e as Error).message}`);
      }
    }
    if (errors.length === 0) {
      await admin.rpc("ops_alert_webhook_mark", { _id: row.id, _status: "sent", _error: null });
      summary.sent++;
    } else {
      await admin.rpc("ops_alert_webhook_mark", {
        _id: row.id,
        _status: "failed",
        _error: errors.join(" | ").slice(0, 400),
      });
      summary.failed++;
    }
  }

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
