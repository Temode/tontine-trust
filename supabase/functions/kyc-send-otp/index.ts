import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendMessage, normalizeGNPhone } from "../_shared/nimbasms.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

async function sha256(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({} as { phone?: string }));
    const phoneRaw = (body.phone ?? "").trim();
    const phone = normalizeGNPhone(phoneRaw);
    if (!phone) {
      return new Response(JSON.stringify({ error: "INVALID_PHONE" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(url, serviceKey);

    // Rate limit: max 3 OTP / 10 min / user
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await admin
      .from("phone_otp_challenges")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);
    if ((count ?? 0) >= 3) {
      return new Response(JSON.stringify({ error: "RATE_LIMITED" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await sha256(`${user.id}:${code}`);
    const expires_at = new Date(Date.now() + 10 * 60_000).toISOString();

    await admin.from("phone_otp_challenges").insert({
      user_id: user.id, phone_e164: phone, code_hash, expires_at,
    });

    const sms = await sendMessage({
      to: phone,
      body: `Tontine Digital: votre code de vérification est ${code}. Valable 10 minutes. Ne le partagez jamais.`,
      logContext: { userId: user.id, kind: "kyc_phone_otp" },
    });

    if (!sms.success) {
      return new Response(JSON.stringify({ error: "SMS_FAILED", detail: sms.error }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, phone }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[kyc-send-otp]", e);
    return new Response(JSON.stringify({ error: "INTERNAL" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});