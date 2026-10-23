/**
 * sms-control — contrôle admin du système d'envoi SMS.
 *
 * GET  → { paused, min_balance, balance, max_per_run }
 * POST { paused: boolean }       → bascule sms_paused
 * POST { refresh_balance: true } → force un re-check Nimba balance
 *
 * Réservé aux admins (vérifie user_roles).
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const NIMBA_API_BASE = "https://api.nimbasms.com/v1";

async function fetchNimbaBalance(): Promise<number | null> {
  const sid = Deno.env.get("NIMBA_SERVICE_ID");
  const tok = Deno.env.get("NIMBA_SECRET_TOKEN");
  if (!sid || !tok) return null;
  try {
    const auth = btoa(`${sid}:${tok}`);
    const res = await fetch(`${NIMBA_API_BASE}/accounts/balance`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) return null;
    const d = await res.json().catch(() => null) as any;
    const b = d?.balance ?? d?.sms_balance ?? d?.amount;
    return typeof b === "number" ? b : Number(b ?? NaN);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Vérifie le JWT et le rôle admin
  const authz = req.headers.get("Authorization") ?? "";
  const jwt = authz.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(url, jwt, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userRes } = await userClient.auth.getUser();
  const userId = userRes?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(url, srv);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const readConfig = async () => {
    const { data } = await admin
      .from("internal_config")
      .select("key, value")
      .in("key", ["sms_paused", "sms_min_balance", "sms_max_per_run"]);
    const map = new Map((data ?? []).map((r: any) => [r.key, r.value]));
    return {
      paused: String(map.get("sms_paused") ?? "false").toLowerCase() === "true",
      min_balance: Number(map.get("sms_min_balance") ?? 0),
      max_per_run: Number(map.get("sms_max_per_run") ?? 60),
    };
  };

  if (req.method === "GET") {
    const cfg = await readConfig();
    const balance = await fetchNimbaBalance();
    return new Response(JSON.stringify({ ...cfg, balance }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.paused === "boolean") {
      await admin
        .from("internal_config")
        .upsert({ key: "sms_paused", value: body.paused ? "true" : "false" });
    }
    const cfg = await readConfig();
    const balance = await fetchNimbaBalance();
    return new Response(JSON.stringify({ ...cfg, balance, ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "method_not_allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});