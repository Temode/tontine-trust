// Helper Djomy partagé entre toutes les edge functions.
// HMAC-SHA256(clientId, clientSecret) → X-API-KEY: clientId:signature
// Bearer token via POST /v1/auth, mis en cache process.

const BASE_URLS = {
  sandbox: "https://sandbox-api.djomy.africa",
  prod: "https://api.djomy.africa",
} as const;

export const DJOMY_PARTNER_DOMAIN =
  "dcaa27935b4920eb5e7c2c9a1d35a5040493b177bed92d9b69966c46eca6a627";

export function djomyBaseUrl(): string {
  return djomyEnv() === "prod" ? BASE_URLS.prod : BASE_URLS.sandbox;
}

export function djomyEnv(): "sandbox" | "prod" {
  const v = (Deno.env.get("DJOMY_ENV") ?? "sandbox").toLowerCase();
  return v === "prod" || v === "production" || v === "live" ? "prod" : "sandbox";
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return hex(sig);
}

export function extractDjomyWebhookSignature(header: string | null): string {
  const raw = String(header ?? "").trim();
  if (!raw) return "";

  for (const part of raw.split(",").map((p) => p.trim()).filter(Boolean)) {
    const normalized = part.replace(/^sha256=/i, "");
    const prefixed = normalized.match(/^v1[:=]([a-f0-9]+)$/i);
    if (prefixed?.[1]) return prefixed[1].toLowerCase();
    if (/^[a-f0-9]+$/i.test(normalized)) return normalized.toLowerCase();
  }

  const fallback = raw.includes(":") ? raw.split(":").slice(-1)[0] : raw;
  return fallback.trim().replace(/^sha256=/i, "").toLowerCase();
}

export function mapDjomyEventStatus(eventType: string): string | null {
  const map: Record<string, string> = {
    "payment.success": "succeeded",
    "payment.failed": "failed",
    "payment.cancelled": "cancelled",
    "payment.created": "pending",
    "payment.pending": "pending",
    "payment.redirected": "pending",
  };
  return map[eventType] ?? null;
}

export function getDjomyWebhookContext(payload: Record<string, unknown>) {
  const data = (payload.data as Record<string, unknown> | undefined) ?? {};
  const dataMetadata = (data.metadata as Record<string, unknown> | undefined) ?? {};
  const rootMetadata = (payload.metadata as Record<string, unknown> | undefined) ?? {};
  const metadata = { ...dataMetadata, ...rootMetadata };
  const eventType = String(payload.eventType ?? "unknown");

  const transactionId =
    (data.transactionId as string | undefined) ??
    (data.transaction_id as string | undefined) ??
    (payload.transactionId as string | undefined) ??
    null;
  const merchantRef =
    (data.merchantPaymentReference as string | undefined) ??
    (payload.merchantPaymentReference as string | undefined) ??
    (metadata.subscription_id as string | undefined) ??
    (metadata.payment_id as string | undefined) ??
    null;

  return {
    eventId: (payload.eventId as string | undefined) ?? crypto.randomUUID(),
    eventType,
    data,
    metadata,
    transactionId,
    merchantRef,
    purpose: String(metadata.purpose ?? ""),
    newStatus: mapDjomyEventStatus(eventType),
  };
}

export async function buildApiKeyHeader(): Promise<string> {
  const clientId = Deno.env.get("DJOMY_CLIENT_ID");
  const clientSecret = Deno.env.get("DJOMY_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("DJOMY_CREDENTIALS_MISSING");
  // Djomy : signature = HMAC_SHA256(clientId, clientSecret)
  // (l'algo crypto-js HmacSHA256(key, secret) place `secret` comme clé HMAC)
  const sig = await hmacSha256Hex(clientSecret, clientId);
  return `${clientId}:${sig}`;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getDjomyBearer(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.token;
  const apiKey = await buildApiKeyHeader();
  const authUrl = `${djomyBaseUrl()}/v1/auth`;
  console.log("[djomy] AUTH URL =", authUrl, "ENV=", Deno.env.get("DJOMY_ENV"));
  const res = await fetch(authUrl, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "X-PARTNER-DOMAIN": DJOMY_PARTNER_DOMAIN,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`DJOMY_AUTH_FAILED:${res.status}:${raw}`);
  const data = JSON.parse(raw);
  const token: string | undefined =
    data.accessToken ?? data.access_token ?? data.token ?? data?.data?.accessToken;
  if (!token) throw new Error(`DJOMY_AUTH_NO_TOKEN:${raw}`);
  // tente d'extraire expiresIn (secondes), sinon 50 minutes par défaut
  const expiresIn: number = Number(data.expiresIn ?? data.expires_in ?? 3000);
  cachedToken = { token, expiresAt: now + (expiresIn - 60) * 1000 };
  return token;
}

export async function djomyFetch(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; data: unknown; raw: string }> {
  const apiKey = await buildApiKeyHeader();
  const bearer = await getDjomyBearer();
  const res = await fetch(`${djomyBaseUrl()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "X-API-KEY": apiKey,
      "X-PARTNER-DOMAIN": DJOMY_PARTNER_DOMAIN,
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const raw = await res.text();
  let data: unknown = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { ok: res.ok, status: res.status, data, raw };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Normalise un numéro guinéen vers le format international 00224XXXXXXXX accepté par Djomy. */
export function normalizePhone(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 0) throw new Error("PHONE_EMPTY");
  if (digits.startsWith("00")) return digits;
  if (digits.startsWith("224")) return `00${digits}`;
  // numéro local 9 chiffres → préfixe Guinée par défaut
  if (digits.length === 9) return `00224${digits}`;
  // déjà 00... ou international quelconque
  return digits.startsWith("0") ? digits : `00${digits}`;
}