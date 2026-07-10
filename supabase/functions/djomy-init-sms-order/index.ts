import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, djomyFetch, json, normalizePhone } from "../_shared/djomy.ts";

interface Body {
  packId: string;
  groupId?: string | null;
  payerPhone: string;
  returnUrl: string;
  cancelUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "AUTH_REQUIRED" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u, error: ue } = await userClient.auth.getUser();
    if (ue || !u.user) return json({ error: "INVALID_TOKEN" }, 401);

    let body: Body;
    try { body = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
    if (!body.packId || !body.payerPhone || !body.returnUrl) return json({ error: "MISSING_FIELDS" }, 400);
    if (!/^https:\/\//.test(body.returnUrl)) {
      return json({ error: "RETURN_URL_NOT_HTTPS", hint: "Djomy exige une returnUrl en HTTPS." }, 400);
    }

    const phone = normalizePhone(body.payerPhone);

    const { data: rows, error: startErr } = await userClient.rpc("start_sms_order_checkout", {
      _pack_id: body.packId,
      _group_id: body.groupId ?? null,
    });
    if (startErr) return json({ error: startErr.message }, 400);
    const order = Array.isArray(rows) ? rows[0] : rows;
    if (!order?.id) return json({ error: "SMS_ORDER_CREATE_FAILED" }, 500);

    const amount = Number(order.amount);
    if (!amount || amount <= 0) return json({ error: "INVALID_AMOUNT" }, 400);

    const djomyRes = await djomyFetch("/v1/payments/gateway", {
      method: "POST",
      body: {
        amount,
        countryCode: "GN",
        payerNumber: phone,
        allowedPaymentMethods: ["OM", "MOMO", "CARD"],
        description: `Recharge ${order.qty} SMS Tontine Digital`,
        merchantPaymentReference: order.id,
        returnUrl: body.returnUrl,
        cancelUrl: body.cancelUrl ?? body.returnUrl,
        metadata: {
          sms_order_id: order.id,
          pack_id: order.pack_id,
          qty: order.qty,
          purpose: "sms_order",
        },
      },
    });

    if (!djomyRes.ok) {
      const admin = createClient(url, serviceKey);
      await admin.rpc("apply_sms_order_webhook", {
        _order_id: order.id,
        _new_status: "failed",
        _djomy_ref: null,
      });
      return json({ error: "DJOMY_INIT_FAILED", details: djomyRes.data }, 502);
    }

    const d = djomyRes.data as Record<string, unknown> & { data?: Record<string, unknown> };
    const inner = (d.data as Record<string, unknown> | undefined) ?? d;
    const txId = (inner.transactionId as string) ?? (inner.transaction_id as string) ?? (inner.id as string) ?? "";
    const redirectUrl =
      (inner.redirectUrl as string) ?? (inner.paymentUrl as string) ?? (inner.url as string) ?? "";
    if (!redirectUrl) return json({ error: "DJOMY_NO_REDIRECT", details: djomyRes.data }, 502);

    const admin = createClient(url, serviceKey);
    await admin.from("sms_orders").update({ djomy_ref: txId }).eq("id", order.id);

    return json({ orderId: order.id, transactionId: txId, redirectUrl, amount, qty: order.qty });
  } catch (e) {
    console.error("[djomy-init-sms-order]", e);
    return json({ error: "INTERNAL", message: (e as Error).message }, 500);
  }
});