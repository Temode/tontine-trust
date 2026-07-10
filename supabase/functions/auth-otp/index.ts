import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SignupEmail } from "../_shared/email-templates/signup.tsx";
import { RecoveryEmail } from "../_shared/email-templates/recovery.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const RESEND_GATEWAY_URL = "https://connector-gateway.lovable.dev/resend/emails";
const SITE_NAME = "Tontine Digitale";
const SITE_URL = "https://tontinedigitale.com";
const FROM_EMAIL = "noreply@tontinedigitale.com";
const FROM_ADDRESS = `Tontine Digitale <${FROM_EMAIL}>`;
// Garde-fou : toute autre valeur (ex. l'expéditeur par défaut Lovable) est
// refusée pour empêcher la moindre régression vers un autre expéditeur.
const ALLOWED_FROM_DOMAIN = "tontinedigitale.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RECENT_WINDOW_MINUTES = 10;
const RECENT_LIMIT = 3;
const OTP_TTL_MINUTES = 15;

type Purpose = "signup" | "recovery";

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return EMAIL_RE.test(email) && email.length <= 255 ? email : null;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function checkRateLimit(admin: ReturnType<typeof createClient>, emailHash: string, purpose: Purpose) {
  const since = new Date(Date.now() - RECENT_WINDOW_MINUTES * 60_000).toISOString();
  const { count, error } = await admin
    .from("auth_otp_requests")
    .select("id", { count: "exact", head: true })
    .eq("email_hash", emailHash)
    .eq("purpose", purpose)
    .gte("created_at", since);
  if (error) {
    console.error("[auth-otp] rate-limit lookup failed", error);
    return false;
  }
  return (count ?? 0) >= RECENT_LIMIT;
}

async function logOtp(admin: ReturnType<typeof createClient>, args: {
  email: string;
  emailHash: string;
  purpose: Purpose;
  tokenHash?: string;
  providerMessageId?: string | null;
  status: "sent" | "failed" | "consumed";
  errorMessage?: string | null;
  expiresAt?: string;
}) {
  const { error } = await admin.from("auth_otp_requests").insert({
    email: args.email,
    email_hash: args.emailHash,
    purpose: args.purpose,
    token_hash: args.tokenHash ?? null,
    provider_message_id: args.providerMessageId ?? null,
    status: args.status,
    error_message: args.errorMessage ?? null,
    expires_at: args.expiresAt ?? new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
  });
  if (error) console.error("[auth-otp] log insert failed", error);
}

async function markConsumed(admin: ReturnType<typeof createClient>, tokenHash: string) {
  const { error } = await admin
    .from("auth_otp_requests")
    .update({ status: "consumed", consumed_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .in("status", ["sent", "failed"]);
  if (error) console.error("[auth-otp] consume update failed", error);
}

function generateNumericCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 1_000_000).toString().padStart(6, "0");
}

type MinimalUser = { id: string; email?: string; email_confirmed_at?: string | null };

async function findExistingUser(admin: ReturnType<typeof createClient>, email: string): Promise<MinimalUser | null> {
  const adminAuth = admin.auth.admin as unknown as {
    listUsers: (opts: { page: number; perPage: number }) => Promise<{
      data: { users: MinimalUser[] };
      error: { message: string } | null;
    }>;
  };
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await adminAuth.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("[auth-otp] listUsers failed", error.message);
      return null;
    }
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function sendOtpEmail(args: {
  email: string;
  purpose: Purpose;
  token: string;
  actionLink?: string;
}) {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!lovableApiKey || !resendApiKey) {
    return { ok: false, status: 500, body: "email_not_configured", id: null };
  }

  // Assertion défensive : jamais d'expéditeur hors domaine Tontine Digitale.
  const fromDomain = FROM_EMAIL.split("@")[1]?.toLowerCase();
  if (fromDomain !== ALLOWED_FROM_DOMAIN) {
    console.error("[auth-otp] refused sending: FROM domain mismatch", { fromDomain });
    return { ok: false, status: 500, body: "invalid_sender", id: null };
  }

  const Template = args.purpose === "signup" ? SignupEmail : RecoveryEmail;
  const props = {
    siteName: SITE_NAME,
    siteUrl: SITE_URL,
    recipient: args.email,
    confirmationUrl: args.actionLink ?? SITE_URL,
    token: args.token,
  };
  const html = await renderAsync(React.createElement(Template, props));
  const text = await renderAsync(React.createElement(Template, props), { plainText: true });
  const subject =
    args.purpose === "signup"
      ? "Votre code de vérification Tontine Digitale"
      : "Réinitialiser votre mot de passe";

  const response = await fetch(RESEND_GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": resendApiKey,
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [args.email],
      subject,
      html,
      text,
      tags: [{ name: "category", value: `auth_${args.purpose}` }],
    }),
  });

  const body = await response.text();
  if (!response.ok) return { ok: false, status: response.status, body, id: null };
  let parsed: { id?: string } = {};
  try {
    parsed = JSON.parse(body);
  } catch {
    // Resend renvoie du JSON, mais on garde une sortie tolérante.
  }
  return { ok: true, status: response.status, body, id: parsed.id ?? null };
}

function mapAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("already") || m.includes("registered")) return "email_exists";
  if (m.includes("password") || m.includes("weak")) return "weak_password";
  if (m.includes("rate")) return "rate_limited";
  return "server_error";
}

type OtpLookup =
  | { kind: "ok"; id: string }
  | { kind: "not_found" }
  | { kind: "expired" }
  | { kind: "consumed" };

async function findOtpForVerification(
  admin: ReturnType<typeof createClient>,
  emailHash: string,
  purpose: Purpose,
  tokenHash: string,
): Promise<OtpLookup> {
  const { data, error } = await admin
    .from("auth_otp_requests")
    .select("id, expires_at, status, purpose")
    .eq("email_hash", emailHash)
    .eq("purpose", purpose)
    .eq("token_hash", tokenHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[auth-otp] find OTP failed", error);
    return { kind: "not_found" };
  }
  if (!data) return { kind: "not_found" };
  if (data.purpose !== purpose) return { kind: "not_found" };
  if (data.status === "consumed") return { kind: "consumed" };
  if (new Date(data.expires_at).getTime() < Date.now()) return { kind: "expired" };
  if (data.status !== "sent") return { kind: "not_found" };
  return { kind: "ok", id: data.id as string };
}

async function issueOtp(
  admin: ReturnType<typeof createClient>,
  args: { email: string; emailHash: string; purpose: Purpose },
) {
  const token = generateNumericCode();
  const tokenHash = await sha256(`${args.emailHash}:${args.purpose}:${token}`);
  const sent = await sendOtpEmail({
    email: args.email,
    purpose: args.purpose,
    token,
    actionLink: SITE_URL,
  });
  await logOtp(admin, {
    email: args.email,
    emailHash: args.emailHash,
    purpose: args.purpose,
    tokenHash,
    providerMessageId: sent.id,
    status: sent.ok ? "sent" : "failed",
    errorMessage: sent.ok ? null : `Resend ${sent.status}: ${sent.body.slice(0, 500)}`,
  });
  return sent;
}

async function startSignup(admin: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);
  if (!email) return json({ error: "invalid_email" }, 400);

  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : null;
  if (password.length < 8 || password.length > 72 || fullName.length < 2) {
    return json({ error: "invalid_payload" }, 400);
  }

  const emailHash = await sha256(email);
  if (await checkRateLimit(admin, emailHash, "signup")) return json({ error: "rate_limited" }, 429);

  const existing = await findExistingUser(admin, email);
  if (existing?.email_confirmed_at) {
    return json({ error: "email_exists" }, 400);
  }
  if (existing) {
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: { full_name: fullName, phone_number: phoneNumber, otp_verified: false },
    });
    if (updErr) {
      console.error("[auth-otp] refresh unverified user failed", updErr.message);
      return json({ error: mapAuthError(updErr.message) }, updErr.status ?? 400);
    }
  } else {
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone_number: phoneNumber, otp_verified: false },
    });
    if (createErr) {
      const mapped = mapAuthError(createErr.message);
      if (mapped === "server_error") console.error("[auth-otp] createUser failed", createErr.message);
      return json({ error: mapped }, createErr.status ?? 400);
    }
  }

  const sent = await issueOtp(admin, { email, emailHash, purpose: "signup" });
  if (!sent.ok) {
    console.error("[auth-otp] resend failed (signup)", { status: sent.status, body: sent.body });
    return json({ error: sent.status === 500 ? "email_not_configured" : "email_send_failed" }, 502);
  }
  return json({ success: true });
}

async function startRecovery(admin: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);
  if (!email) return json({ error: "invalid_email" }, 400);

  const emailHash = await sha256(email);
  if (await checkRateLimit(admin, emailHash, "recovery")) return json({ error: "rate_limited" }, 429);

  const existing = await findExistingUser(admin, email);
  // Ne divulgue pas l'existence du compte.
  if (!existing) return json({ success: true });

  const sent = await issueOtp(admin, { email, emailHash, purpose: "recovery" });
  if (!sent.ok) {
    console.error("[auth-otp] resend failed (recovery)", { status: sent.status, body: sent.body });
    return json({ error: sent.status === 500 ? "email_not_configured" : "email_send_failed" }, 502);
  }
  return json({ success: true });
}

async function verifySignup(
  admin: ReturnType<typeof createClient>,
  anon: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const email = normalizeEmail(body.email);
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !/^\d{6}$/.test(token)) return json({ error: "invalid_code" }, 400);

  const emailHash = await sha256(email);
  const tokenHash = await sha256(`${emailHash}:signup:${token}`);
  const otp = await findOtpForVerification(admin, emailHash, "signup", tokenHash);
  if (otp.kind === "expired") return json({ error: "code_expired" }, 400);
  if (otp.kind === "consumed") return json({ error: "code_already_used" }, 400);
  if (otp.kind !== "ok") return json({ error: "invalid_code" }, 400);

  const existing = await findExistingUser(admin, email);
  if (!existing) return json({ error: "invalid_code" }, 400);

  {
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      user_metadata: {
        ...((existing as unknown as { user_metadata?: Record<string, unknown> }).user_metadata ?? {}),
        otp_verified: true,
      },
    } as never);
    if (updErr) {
      console.error("[auth-otp] mark otp_verified failed", updErr.message);
      return json({ error: "server_error" }, 500);
    }
  }
  await markConsumed(admin, tokenHash);

  if (password.length >= 8 && password.length <= 72) {
    const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
    if (signInErr || !signInData.session) {
      console.warn("[auth-otp] auto-signin failed after verify", signInErr?.message);
      return json({ success: true });
    }
    return json({ success: true, session: signInData.session });
  }
  return json({ success: true });
}

async function completeRecovery(admin: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !/^\d{6}$/.test(token)) return json({ error: "invalid_code" }, 400);
  if (password.length < 8 || password.length > 72) return json({ error: "weak_password" }, 400);

  const emailHash = await sha256(email);
  const tokenHash = await sha256(`${emailHash}:recovery:${token}`);
  const otp = await findOtpForVerification(admin, emailHash, "recovery", tokenHash);
  if (otp.kind === "expired") return json({ error: "code_expired" }, 400);
  if (otp.kind === "consumed") return json({ error: "code_already_used" }, 400);
  if (otp.kind !== "ok") return json({ error: "invalid_code" }, 400);

  const existing = await findExistingUser(admin, email);
  if (!existing) return json({ error: "invalid_code" }, 400);

  const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  } as never);
  if (updateError) {
    console.error("[auth-otp] password update failed", updateError.message);
    return json({ error: "password_update_failed" }, 500);
  }
  await markConsumed(admin, tokenHash);
  return json({ success: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return json({ error: "server_error" }, 500);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });

  try {
    switch (body.action) {
      case "signup_start":
        return await startSignup(admin, body);
      case "recovery_start":
        return await startRecovery(admin, body);
      case "verify_signup":
        return await verifySignup(admin, anon, body);
      case "recovery_complete":
        return await completeRecovery(admin, body);
      default:
        return json({ error: "invalid_action" }, 400);
    }
  } catch (error) {
    console.error("[auth-otp] unhandled", error);
    return json({ error: "server_error" }, 500);
  }
});