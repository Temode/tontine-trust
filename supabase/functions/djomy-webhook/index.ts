// redeploy-trigger: 2026-06-16
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, hmacSha256Hex, json } from "../_shared/djomy.ts";
import { sendMessageBg, fmtSms, normalizeGNPhone } from "../_shared/nimbasms.ts";

// PUBLIC endpoint : signature HMAC requise. verify_jwt = false dans config.toml.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const rawBody = await req.text();
  const sigHeader = req.headers.get("x-webhook-signature") ?? req.headers.get("X-Webhook-Signature") ?? "";
  const webhookSecret = Deno.env.get("DJOMY_WEBHOOK_SECRET") ?? "";
  const clientSecret = Deno.env.get("DJOMY_CLIENT_SECRET") ?? "";
  if (!webhookSecret && !clientSecret) return json({ error: "WEBHOOK_SECRET_MISSING" }, 500);

  // Format Djomy : `X-Webhook-Signature: v1:<hex>` — HMAC-SHA256(payload) avec
  // la clé secrète marchand. On accepte aussi un header brut sans préfixe.
  const provided = (sigHeader.includes(":") ? sigHeader.split(":").slice(-1)[0] : sigHeader).trim().toLowerCase();
  let signatureValid = false;
  let matchedKey: "webhook" | "client" | null = null;
  for (const key of [webhookSecret, clientSecret].filter(Boolean) as string[]) {
    const expected = (await hmacSha256Hex(key, rawBody)).toLowerCase();
    if (provided.length > 0 && provided === expected) {
      signatureValid = true;
      matchedKey = key === webhookSecret ? "webhook" : "client";
      break;
    }
  }
  if (!signatureValid) {
    const expectedWebhook = webhookSecret ? (await hmacSha256Hex(webhookSecret, rawBody)).slice(0, 12) : "n/a";
    const expectedClient = clientSecret ? (await hmacSha256Hex(clientSecret, rawBody)).slice(0, 12) : "n/a";
    console.warn("[djomy-webhook] signature diag", {
      provided_prefix: provided.slice(0, 12),
      expected_with_webhook_secret_prefix: expectedWebhook,
      expected_with_client_secret_prefix: expectedClient,
      body_length: rawBody.length,
    });
  } else {
    console.log("[djomy-webhook] signature OK via", matchedKey);
  }

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
  const metadata = (data.metadata as Record<string, unknown> | undefined) ?? {};
  const purpose = String(metadata.purpose ?? "");

  // Idempotence forte : si l'eventId existe déjà, on a déjà traité — on sort sans rien refaire.
  // (Évite double SMS / double validation de caution en cas de re-livraison Djomy.)
  if (signatureValid) {
    const { data: existing } = await admin
      .from("djomy_webhook_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();
    if (existing) {
      console.log("[djomy-webhook] duplicate event, skipping", eventId);
      return json({ ok: true, ignored: "already_processed", eventId }, 200);
    }
  }
  const { error: insErr } = await admin
    .from("djomy_webhook_events")
    .insert({
      event_id: eventId,
      event_type: eventType,
      transaction_id: transactionId,
      signature_valid: signatureValid,
      payload,
    });
  if (insErr) {
    // Course inter-livraisons : un autre worker a inséré le même eventId entre temps.
    if (String(insErr.message).toLowerCase().includes("duplicate")) {
      return json({ ok: true, ignored: "already_processed_race", eventId }, 200);
    }
    console.error("[djomy-webhook] event insert error", insErr);
  }

  if (!signatureValid) {
    return json({ ok: true, ignored: "invalid_signature" }, 200);
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

  // Routage cautions : si purpose=deposit ou si le ref correspond à un member_deposit
  let depositId: string | null = null;
  if (purpose === "deposit" && merchantRef) {
    depositId = merchantRef;
  } else if (merchantRef) {
    const { data: dep } = await admin
      .from("member_deposits").select("id")
      .eq("id", merchantRef).maybeSingle();
    if (dep) depositId = dep.id;
  }
  if (depositId) {
    if (!newStatus) return json({ ok: true, ignored: "unhandled_event" }, 200);
    // Snapshot AVANT pour ne notifier que sur transition réelle
    const { data: before } = await admin
      .from("member_deposits")
      .select("id, user_id, group_id, amount, months, status")
      .eq("id", depositId)
      .maybeSingle();
    const previousStatus = before?.status ?? null;

    const { error: depErr } = await admin.rpc("apply_deposit_webhook", {
      _deposit_id: depositId,
      _new_status: newStatus,
      _provider_ref: transactionId,
      _payment_method: (data.paymentMethod as string) ?? null,
    });
    if (depErr) {
      console.error("[djomy-webhook] deposit rpc error", depErr);
      return json({ ok: false, error: depErr.message }, 500);
    }

    // Notifie le membre uniquement si le statut a changé vers paid/failed.
    const mappedNew =
      newStatus === "succeeded" || newStatus === "paid" ? "paid"
      : newStatus === "failed" ? "failed"
      : null;
    const shouldNotify = mappedNew && previousStatus !== mappedNew
      && (previousStatus === null || previousStatus === "pending");
    if (shouldNotify && before?.user_id) {
      try {
        const { data: prof } = await admin
          .from("profiles")
          .select("phone_number")
          .eq("id", before.user_id)
          .maybeSingle();
        const phone = normalizeGNPhone(prof?.phone_number ?? null);

        const { data: pref } = await admin
          .from("notification_preferences")
          .select("enabled")
          .eq("user_id", before.user_id)
          .eq("notif_type", "deposit_status")
          .eq("channel", "sms")
          .maybeSingle();
        const optedIn = pref?.enabled !== false; // défaut ON

        if (phone && optedIn) {
          const { data: grp } = await admin
            .from("groups").select("name").eq("id", before.group_id).maybeSingle();
          const gname = (grp?.name as string | undefined) ?? "Tontine";
          const amount = Number(before.amount ?? 0);
          const body = mappedNew === "paid"
            ? `Tontine ${gname}: caution de ${fmtSms(amount)} GNF validée. Votre participation est activée. Merci!`
            : `Tontine ${gname}: paiement de votre caution (${fmtSms(amount)} GNF) ECHOUE. Reprenez le dépôt depuis l'app.`;
          sendMessageBg({
            to: phone,
            body,
            logContext: {
              userId: before.user_id,
              groupId: before.group_id,
              kind: `deposit_${mappedNew}`,
            },
          });
        }
      } catch (e) {
        console.error("[djomy-webhook] deposit sms hook failed:", e);
      }
    }

    return json({
      ok: true, depositId, status: newStatus,
      transitioned: shouldNotify ? mappedNew : null,
      previousStatus,
    });
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

  // SMS de confirmation au payeur lorsqu'un paiement est validé
  if (newStatus === "succeeded") {
    try {
      const { data: pay } = await admin
        .from("payments")
        .select("user_id, contribution_id")
        .eq("id", paymentId)
        .maybeSingle();
      if (pay?.user_id) {
        const { data: prof } = await admin
          .from("profiles")
          .select("phone_number")
          .eq("id", pay.user_id)
          .maybeSingle();
        const phone = normalizeGNPhone(prof?.phone_number ?? null);

        const { data: pref } = await admin
          .from("notification_preferences")
          .select("enabled")
          .eq("user_id", pay.user_id)
          .eq("notif_type", "contribution_confirmed")
          .eq("channel", "sms")
          .maybeSingle();
        const optedIn = pref?.enabled !== false; // défaut ON

        if (phone && optedIn && pay.contribution_id) {
          const { data: ctx } = await admin
            .from("contributions")
            .select("amount, group_id, turn_id, groups(name), turns(turn_number, due_date)")
            .eq("id", pay.contribution_id)
            .maybeSingle();
          const groupName = (ctx as any)?.groups?.name ?? "Tontine";
          const turnNumber = (ctx as any)?.turns?.turn_number ?? "";
          const amount = Number((ctx as any)?.amount ?? data.paidAmount ?? 0);
          const date = new Date().toLocaleDateString("fr-FR");
          const body =
            `Tontine ${groupName}: paiement de ${fmtSms(amount)} GNF ` +
            `confirmé le ${date} (tour #${turnNumber}). Merci!`;
          sendMessageBg({
            to: phone,
            body,
            logContext: {
              userId: pay.user_id,
              groupId: (ctx as any)?.group_id ?? null,
              turnId: (ctx as any)?.turn_id ?? null,
              kind: "payment_confirmed",
            },
          });
        }
      }
    } catch (e) {
      console.error("[djomy-webhook] sms hook failed:", e);
    }
  }

  return json({ ok: true, paymentId, status: newStatus });
});