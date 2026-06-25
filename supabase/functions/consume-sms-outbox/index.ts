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
// Verrou consultatif global Postgres (clé fixe = 'sms_outbox_worker').
// Empêche deux invocations simultanées (cron + manuel) de consommer la file
// en parallèle — garantit le traitement FIFO séquentiel.
const ADVISORY_LOCK_KEY = 8731298731298731n; // bigint stable

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

  // Récupère le token interne, le plafond par run et le plafond global SMS/minute.
  const [{ data: tokRow }, { data: maxRow }, { data: rateRow }] = await Promise.all([
    admin.from("internal_config").select("value").eq("key", "tontine_sms_token").maybeSingle(),
    admin.from("internal_config").select("value").eq("key", "sms_max_per_run").maybeSingle(),
    admin
      .from("internal_config")
      .select("value")
      .eq("key", "sms_max_per_minute_global")
      .maybeSingle(),
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
  const ratePerMin = Math.max(
    1,
    Number((rateRow as { value?: string } | null)?.value ?? 30),
  );

  // 1) Verrou consultatif : un seul worker actif à la fois.
  const { data: lockRow, error: lockErr } = await admin.rpc("pg_try_advisory_lock", {
    key: Number(ADVISORY_LOCK_KEY),
  } as never);
  // Fallback : si la RPC n'est pas exposée, on tente via une requête select.
  let lockAcquired: boolean | null = null;
  if (!lockErr && lockRow !== null && lockRow !== undefined) {
    lockAcquired = Boolean(lockRow);
  }
  if (lockAcquired === null) {
    // Sans verrou exposable côté PostgREST, on s'appuie sur `for update skip locked`
    // de sms_outbox_pop : la concurrence ne provoque pas de doublon mais peut
    // briser le FIFO strict. On loggue l'info.
    console.warn("[consume-sms-outbox] advisory lock indisponible, fallback skip-locked");
  } else if (!lockAcquired) {
    return new Response(
      JSON.stringify({ ok: true, skipped: "another_worker_running" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2) Rate limit global : combien de SMS sont déjà partis dans les 60 dernières s ?
  const { data: sentLastMin } = await admin.rpc("sms_outbox_recent_sent_count", {
    _minutes: 1,
  });
  const alreadySent = Number(sentLastMin ?? 0);
  const remainingThisMinute = Math.max(0, ratePerMin - alreadySent);
  if (remainingThisMinute === 0) {
    return new Response(
      JSON.stringify({
        ok: true,
        skipped: "rate_limit_per_minute",
        rate_per_min: ratePerMin,
        sent_last_minute: alreadySent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const effectiveCap = Math.min(cap, remainingThisMinute);

  // 3) Pop FIFO atomique (ordre created_at, `for update skip locked`).
  const { data: rows, error: popErr } = await admin.rpc("sms_outbox_pop", {
    _limit: effectiveCap,
  });
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

  // Traitement séquentiel (await dans la boucle) — pas de Promise.all.
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

  // Libère le verrou consultatif (best-effort, ne bloque jamais la réponse).
  if (lockAcquired) {
    await admin
      .rpc("pg_advisory_unlock", { key: Number(ADVISORY_LOCK_KEY) } as never)
      .catch(() => null);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      popped: queued.length,
      sent: ok,
      failed: ko,
      rate_per_min: ratePerMin,
      sent_last_minute: alreadySent,
      cap_used: effectiveCap,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});