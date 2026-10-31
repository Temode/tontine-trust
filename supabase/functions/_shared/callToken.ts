// Jeton court par destinataire : {c: call_id, u: user_id, e: expiration epoch s}.
// Il ne vaut que pour une réponse à un seul appel ; la clé ne quitte jamais le serveur.
const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fromB64url(s: string): Uint8Array {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
}
async function key(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export const CALL_TOKEN_TTL_S = 90;

export async function signCallToken(secret: string, callId: string, userId: string, now = Date.now()): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ c: callId, u: userId, e: Math.floor(now / 1000) + CALL_TOKEN_TTL_S })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verifyCallToken(
  secret: string, token: string, now = Date.now(),
): Promise<{ callId: string; userId: string } | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", await key(secret), fromB64url(sig), enc.encode(body));
  } catch { return null; }
  if (!ok) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (typeof p.c !== "string" || typeof p.u !== "string" || typeof p.e !== "number") return null;
    if (p.e < Math.floor(now / 1000)) return null;
    return { callId: p.c, userId: p.u };
  } catch { return null; }
}
