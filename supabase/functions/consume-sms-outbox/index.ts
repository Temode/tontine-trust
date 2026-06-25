/**
 * consume-sms-outbox — worker FIFO pour la file public.sms_outbox.
 *
 * Appelé toutes les 2 minutes par pg_cron (cf. migration sms_outbox).
 * Pour chaque ligne 'queued', invoque send-tontine-sms en HTTP avec le
 * token interne et marque le résultat. Séquentiel, idempotent grâce au
 * dedupe_key UNIQUE de la file.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_PER_RUN = 20;

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
  const admin = createClient(url, key);

  // Récupère le token interne et le plafond
  const [{ data: tokRow }, { data: maxRow }] = await Promise.all([
    admin.from("internal_config").select("value").eq("key", "tontine_sms_token").maybeSingle(),
    admin.from("internal_config").select("value").eq("key", "sms_max_per_run").maybeSingle(),
  ]);
  const token = (tokRow as { value?: string } | null)?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: "missing_internal_token" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const cap = Math.min(
    MAX_PER_RUN,
    Math.max(1, Number((maxRow as { value?: string } | null)?.value ?? MAX_PER_RUN)),
  );

  // Pop FIFO atomique : passe les lignes à 'processing'
  const { data: rows, error: popErr } = await admin.rpc("sms_outbox_pop", { _limit: cap });
  if (popErr) {
    return new Response(JSON.stringify({ error: "pop_failed", detail: popErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const queued = (rows ?? []) as Array<{
    id: string;
    kind: string;
    payload: Record<string, unknown>;
  }>;

  const sendUrl = `${url}/functions/v1/send-tontine-sms`;
  let ok = 0;
  let ko = 0;

  for (const row of queued) {
    try {
      const r = await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Token": token,
        },
        body: JSON.stringify({ kind: row.kind, ...row.payload }),
      });
      if (r.ok) {
        await admin.rpc("sms_outbox_mark", { _id: row.id, _status: "sent", _error: null });
        ok++;
      } else {
        const text = await r.text().catch(() => "");
        await admin.rpc("sms_outbox_mark", {
          _id: row.id,
          _status: "failed",
          _error: `http_${r.status}:${text.slice(0, 200)}`,
        });
        ko++;
      }
    } catch (e) {
      await admin.rpc("sms_outbox_mark", {
        _id: row.id,
        _status: "failed",
        _error: (e as Error).message.slice(0, 200),
      });
      ko++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, popped: queued.length, sent: ok, failed: ko }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});