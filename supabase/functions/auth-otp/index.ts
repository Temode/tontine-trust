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
const FROM_ADDRESS = "Tontine Digitale <noreply@tontinedigitale.com>";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RECENT_WINDOW_MINUTES = 10;
const RECENT_LIMIT = 3;

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
}) {
  const { error } = await admin.from("auth_otp_requests").insert({
    email: args.email,
    email_hash: args.emailHash,
    purpose: args.purpose,
    token_hash: args.tokenHash ?? null,
    provider_message_id: args.providerMessageId ?? null,
    status: args.status,
    error_message: args.errorMessage ?? null,
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

async function generateSignup(admin: ReturnType<typeof createClient>, body: Record<string, unknown>, email: string) {
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : null;
  if (password.length < 8 || password.length > 72 || fullName.length < 2) {
    return { error: "invalid_payload" as const, status: 400 };
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { data: { full_name: fullName, phone_number: phoneNumber } },
  } as never);
  if (error) return { error: mapAuthError(error.message), status: error.status ?? 400 };
  return { data, status: 200 };
}

async function generateRecovery(admin: ReturnType<typeof createClient>, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email } as never);
  if (error) {
    const mapped = mapAuthError(error.message);
    if (mapped === "server_error") console.error("[auth-otp] recovery generate failed", error.message);
    return { error: mapped, status: error.status ?? 400 };
  }
  return { data, status: 200 };
}

async function startOtp(admin: ReturnType<typeof createClient>, body: Record<string, unknown>, purpose: Purpose) {
  const email = normalizeEmail(body.email);
  if (!email) return json({ error: "invalid_email" }, 400);

  const emailHash = await sha256(email);
  if (await checkRateLimit(admin, emailHash, purpose)) return json({ error: "rate_limited" }, 429);

  const generated = purpose === "signup"
    ? await generateSignup(admin, body, email)
    : await generateRecovery(admin, email);

  if ("error" in generated) {
    if (purpose === "recovery" && generated.error === "server_error") {
      return json({ success: true });
    }
    return json({ error: generated.error }, generated.status);
  }

  const properties = (generated.data as { properties?: { email_otp?: string; action_link?: string } }).properties;
  const token = properties?.email_otp;
  if (!token) return json({ error: "server_error" }, 500);

  const tokenHash = await sha256(`${emailHash}:${purpose}:${token}`);
  const sent = await sendOtpEmail({ email, purpose, token, actionLink: properties?.action_link });
  await logOtp(admin, {
    email,
    emailHash,
    purpose,
    tokenHash,
    providerMessageId: sent.id,
    status: sent.ok ? "sent" : "failed",
    errorMessage: sent.ok ? null : `Resend ${sent.status}: ${sent.body.slice(0, 500)}`,
  });

  if (!sent.ok) {
    console.error("[auth-otp] resend failed", { purpose, status: sent.status, body: sent.body });
    return json({ error: sent.status === 500 ? "email_not_configured" : "email_send_failed" }, 502);
  }
  return json({ success: true });
}

async function verifySignup(admin: ReturnType<typeof createClient>, anon: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!email || !/^\d{6}$/.test(token)) return json({ error: "invalid_code" }, 400);

  const { data, error } = await anon.auth.verifyOtp({ email, token, type: "signup" });
  if (error || !data.session) return json({ error: "invalid_code" }, 400);

  const tokenHash = await sha256(`${await sha256(email)}:signup:${token}`);
  await markConsumed(admin, tokenHash);
  return json({ success: true, session: data.session });
}

async function completeRecovery(admin: ReturnType<typeof createClient>, anon: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !/^\d{6}$/.test(token)) return json({ error: "invalid_code" }, 400);
  if (password.length < 8 || password.length > 72) return json({ error: "weak_password" }, 400);

  const { data, error } = await anon.auth.verifyOtp({ email, token, type: "recovery" });
  if (error || !data.user) return json({ error: "invalid_code" }, 400);

  const { error: updateError } = await admin.auth.admin.updateUserById(data.user.id, { password });
  if (updateError) {
    console.error("[auth-otp] password update failed", updateError.message);
    return json({ error: "password_update_failed" }, 500);
  }

  const tokenHash = await sha256(`${await sha256(email)}:recovery:${token}`);
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
        return await startOtp(admin, body, "signup");
      case "recovery_start":
        return await startOtp(admin, body, "recovery");
      case "verify_signup":
        return await verifySignup(admin, anon, body);
      case "recovery_complete":
        return await completeRecovery(admin, anon, body);
      default:
        return json({ error: "invalid_action" }, 400);
    }
  } catch (error) {
    console.error("[auth-otp] unhandled", error);
    return json({ error: "server_error" }, 500);
  }
});