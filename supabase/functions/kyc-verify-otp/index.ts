import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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

    const body = await req.json().catch(() => ({} as { code?: string }));
    const code = (body.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: "INVALID_CODE" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(url, serviceKey);
    const { data: challenges } = await admin
      .from("phone_otp_challenges")
      .select("*")
      .eq("user_id", user.id)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    const challenge = challenges?.[0];
    if (!challenge) {
      return new Response(JSON.stringify({ error: "OTP_EXPIRED" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (challenge.attempts >= 5) {
      return new Response(JSON.stringify({ error: "OTP_LOCKED" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const hash = await sha256(`${user.id}:${code}`);
    if (hash !== challenge.code_hash) {
      await admin.from("phone_otp_challenges").update({ attempts: challenge.attempts + 1 }).eq("id", challenge.id);
      return new Response(JSON.stringify({ error: "OTP_MISMATCH" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("phone_otp_challenges").update({ consumed_at: new Date().toISOString() }).eq("id", challenge.id);
    // Persiste le téléphone vérifié sur le profil + bascule kyc_level=1
    await admin.from("profiles").update({ phone_number: challenge.phone_e164 }).eq("id", user.id);
    const { data: level, error: rpcErr } = await userClient.rpc("mark_phone_verified");
    if (rpcErr) {
      return new Response(JSON.stringify({ error: rpcErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, kyc_level: level }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[kyc-verify-otp]", e);
    return new Response(JSON.stringify({ error: "INTERNAL" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});