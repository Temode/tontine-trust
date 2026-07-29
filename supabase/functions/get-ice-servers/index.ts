import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Returns ICE servers (STUN + optional Twilio TURN) for WebRTC calls.
// If TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN are set, mints a short-lived
// Network Traversal Service token. Otherwise returns STUN-only.

const STUN_ONLY: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");

  if (!sid || !token) {
    console.warn("ice-servers stun_only", {
      reason: "twilio_not_configured",
      hasSid: !!sid,
      hasToken: !!token,
    });
    return json({
      iceServers: STUN_ONLY,
      turn: false,
      reason: "twilio_not_configured",
    });
  }

  try {
    console.info("ice-servers turn_configured");
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
      console.error("ice-servers turn_token_failed", { status: res.status, body });
      return json({
        iceServers: STUN_ONLY,
        turn: false,
        reason: "twilio_error",
        status: res.status,
      });
    }
    const data = (await res.json()) as { ice_servers?: RTCIceServer[] };
    const iceServers = data.ice_servers ?? [];
    const hasRelay = iceServers.some((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.some((url) => typeof url === "string" && url.startsWith("turn"));
    });
    console.info("ice-servers turn_token_ok", {
      servers: iceServers.length,
      hasRelay,
    });
    return json({
      iceServers: iceServers.length ? iceServers : STUN_ONLY,
      turn: hasRelay,
      reason: hasRelay ? "turn_available" : "turn_token_without_relay",
    });
  } catch (e) {
    console.error("ice-servers exception", e);
    return json({ iceServers: STUN_ONLY, turn: false, reason: "exception" });
  }
});