import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Returns ICE servers (STUN + optional self-hosted Coturn TURN) for WebRTC.
// If TURN_HOST + TURN_SHARED_SECRET are set, mints ephemeral REST credentials
// (HMAC-SHA1) compatible with Coturn `use-auth-secret`. Otherwise STUN-only.

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

function b64(bytes: ArrayBuffer): string {
  const b = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

export async function buildCoturnCredential(
  secret: string,
  username: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(username));
  return b64(sig);
}

function extractUserLabel(req: Request): string {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return "anon";
  try {
    const parts = m[1].split(".");
    if (parts.length < 2) return "anon";
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return (payload.sub as string) ?? "anon";
  } catch {
    return "anon";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const host = Deno.env.get("TURN_HOST");
  const secret = Deno.env.get("TURN_SHARED_SECRET");

  if (!host || !secret) {
    console.warn("ice-servers stun_only", {
      reason: "coturn_not_configured",
      hasHost: !!host,
      hasSecret: !!secret,
    });
    return json({ iceServers: STUN_ONLY, turn: false, reason: "coturn_not_configured" });
  }

  const udpTcpPort = Number(Deno.env.get("TURN_UDP_TCP_PORT") ?? "3478");
  const tlsPort = Number(Deno.env.get("TURN_TLS_PORT") ?? "5349");
  const rawTtl = Number(Deno.env.get("TURN_TTL_SECONDS") ?? "21600");
  const ttl = Math.min(Math.max(Number.isFinite(rawTtl) ? rawTtl : 21600, 3600), 86400);

  try {
    const expiry = Math.floor(Date.now() / 1000) + ttl;
    const userLabel = extractUserLabel(req);
    const username = `${expiry}:${userLabel}`;
    const credential = await buildCoturnCredential(secret, username);

    const iceServers: RTCIceServer[] = [
      { urls: `turn:${host}:${udpTcpPort}?transport=udp`, username, credential },
      { urls: `turn:${host}:${udpTcpPort}?transport=tcp`, username, credential },
      { urls: `turns:${host}:${tlsPort}?transport=tcp`, username, credential },
      ...STUN_ONLY,
    ];

    console.info("ice-servers coturn_credential_ok", {
      host,
      ttl,
      user: userLabel,
    });
    return json({
      iceServers,
      turn: true,
      reason: "coturn",
      ttlSeconds: ttl,
      username,
    });
  } catch (e) {
    console.error("ice-servers coturn_credential_failed", (e as Error).message);
    return json({ iceServers: STUN_ONLY, turn: false, reason: "coturn_credential_failed" });
  }
});