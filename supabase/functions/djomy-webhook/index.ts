import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, hmacSha256Hex, json } from "../_shared/djomy.ts";

// PUBLIC endpoint : signature HMAC requise. verify_jwt = false dans config.toml.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const rawBody = await req.text();
  const sigHeader = req.headers.get("x-webhook-signature") ?? req.headers.get("X-Webhook-Signature") ?? "";
  const secret = Deno.env.get("DJOMY_WEBHOOK_SECRET") ?? Deno.env.get("DJOMY_CLIENT_SECRET");
  if (!secret) return json({ error: "WEBHOOK_SECRET_MISSING" }, 500);

  // format attendu : v1:<hex>
  const provided = sigHeader.includes(":") ? sigHeader.split(":").slice(-1)[0] : sigHeader;
  const expected = await hmacSha256Hex(secret, rawBody);
  const signatureValid = provided.length > 0 && provided.toLowerCase() === expected.toLowerCase();

  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(rawBody); } catch { return json({ error: "INVALID_JSON" }, 400); }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  const eventId = (payload.eventId as string) ?? crypto.randomUUID();
  const eventType = String(payload.eventType ?? "unknown");
  const data = (payload.data as Record<string, unknown> | undefined) ?? {};
  const transactionId = (data.transactionId as string) ?? null;
  const merchantRef = (data.merchantPaymentReference as string) ?? null;

  // Idempotence : upsert event (PK eventId) — si conflit, on a déjà traité.
  const { error: insErr } = await admin
    .from("djomy_webhook_events")
    .insert({
      event_id: eventId,
      event_type: eventType,
      transaction_id: transactionId,
      signature_valid: signatureValid,
      payload,
    });
  if (insErr && !String(insErr.message).toLowerCase().includes("duplicate")) {
    console.error("[djomy-webhook] event insert error", insErr);
  }

  if (!signatureValid) {
    console.warn("[djomy-webhook] invalid signature, ignoring");
    return json({ ok: true, ignored: "invalid_signature" }, 200);
  }

  // Retrouve le payment local
  let paymentId: string | null = null;
  if (merchantRef) paymentId = merchantRef;
  if (!paymentId && transactionId) {
    const { data: p } = await admin
      .from("payments").select("id")
      .eq("djomy_transaction_id", transactionId)
      .maybeSingle();
    paymentId = p?.id ?? null;
  }
  if (!paymentId) {
    console.warn("[djomy-webhook] no local payment for", { merchantRef, transactionId });
    return json({ ok: true, ignored: "unknown_payment" }, 200);
  }

  const map: Record<string, string> = {
    "payment.success": "succeeded",
    "payment.failed": "failed",
    "payment.cancelled": "cancelled",
    "payment.pending": "pending",
    "payment.created": "pending",
    "payment.redirected": "pending",
  };
  const newStatus = map[eventType];
  if (!newStatus) return json({ ok: true, ignored: "unhandled_event" }, 200);

  const { error: rpcErr } = await admin.rpc("apply_djomy_webhook", {
    _payment_id: paymentId,
    _new_status: newStatus,
    _provider_ref: transactionId,
    _paid_amount: Number(data.paidAmount ?? 0),
    _payment_method: (data.paymentMethod as string) ?? null,
  });
  if (rpcErr) {
    console.error("[djomy-webhook] rpc error", rpcErr);
    return json({ ok: false, error: rpcErr.message }, 500);
  }

  return json({ ok: true, paymentId, status: newStatus });
});