import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Returns ICE servers (STUN + optional Twilio TURN) for WebRTC calls.
// If TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN are set, mints a short-lived
// Network Traversal Service token. Otherwise returns STUN-only.

const STUN_ONLY: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");

  if (!sid || !token) {
    return new Response(
      JSON.stringify({ iceServers: STUN_ONLY, turn: false, reason: "twilio_not_configured" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const auth = btoa(`${sid}:${token}`);
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Tokens.json`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}` },
      },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error("Twilio token failed", res.status, body);
      return new Response(
        JSON.stringify({ iceServers: STUN_ONLY, turn: false, reason: "twilio_error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const data = (await res.json()) as { ice_servers?: RTCIceServer[] };
    return new Response(
      JSON.stringify({ iceServers: data.ice_servers ?? STUN_ONLY, turn: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ice-servers exception", e);
    return new Response(
      JSON.stringify({ iceServers: STUN_ONLY, turn: false, reason: "exception" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});