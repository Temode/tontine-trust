import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, djomyFetch, json, normalizePhone } from "../_shared/djomy.ts";
// redeploy-trigger: 2026-06-16

interface Body {
  contributionId: string;
  method: "OM" | "MOMO" | "CARD";
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

    if (!body.contributionId || !body.method || !body.payerPhone || !body.returnUrl) {
      return json({ error: "MISSING_FIELDS" }, 400);
    }
    if (!["OM", "MOMO", "CARD"].includes(body.method)) {
      return json({ error: "INVALID_METHOD" }, 400);
    }
    if (!/^https:\/\//.test(body.returnUrl)) return json({ error: "RETURN_URL_NOT_HTTPS" }, 400);
    if (body.cancelUrl && !/^https:\/\//.test(body.cancelUrl)) {
      return json({ error: "CANCEL_URL_NOT_HTTPS" }, 400);
    }

    const phone = normalizePhone(body.payerPhone);

    // 1. Crée le payment "initiated" via RPC (vérifie ownership + status)
    const { data: paymentId, error: rpcErr } = await userClient.rpc("start_djomy_payment", {
      _contribution_id: body.contributionId,
      _method: body.method,
      _payer_phone: phone,
    });
    if (rpcErr) return json({ error: rpcErr.message }, 400);

    // 2. Charge montant + group via service role (pour metadata)
    const admin = createClient(url, serviceKey);
    const { data: payment } = await admin
      .from("payments")
      .select("id, amount, group_id, contribution_id")
      .eq("id", paymentId)
      .single();
    if (!payment) return json({ error: "PAYMENT_NOT_FOUND" }, 500);

    // 3. Appelle Djomy /v1/payments/gateway
    const djomyRes = await djomyFetch("/v1/payments/gateway", {
      method: "POST",
      body: {
        amount: Number(payment.amount),
        countryCode: "GN",
        payerNumber: phone,
        allowedPaymentMethods: [body.method],
        description: `Cotisation tontine (payment ${payment.id})`,
        merchantPaymentReference: payment.id,
        returnUrl: body.returnUrl,
        cancelUrl: body.cancelUrl ?? body.returnUrl,
        metadata: {
          payment_id: payment.id,
          contribution_id: payment.contribution_id,
          group_id: payment.group_id,
          purpose: "contribution",
        },
      },
    });

    if (!djomyRes.ok) {
      await admin.from("payments")
        .update({ status: "failed", error_message: `djomy:${djomyRes.status}:${djomyRes.raw.slice(0, 500)}`, settled_at: new Date().toISOString() })
        .eq("id", payment.id);
      return json({ error: "DJOMY_INIT_FAILED", details: djomyRes.data }, 502);
    }

    const d = djomyRes.data as Record<string, unknown> & { data?: Record<string, unknown> };
    const inner = (d.data as Record<string, unknown> | undefined) ?? d;
    const txId =
      (inner.transactionId as string) ??
      (inner.transaction_id as string) ??
      (inner.id as string) ??
      "";
    const redirectUrl =
      (inner.redirectUrl as string) ??
      (inner.paymentUrl as string) ??
      (inner.url as string) ??
      "";

    if (!redirectUrl) {
      return json({ error: "DJOMY_NO_REDIRECT", details: djomyRes.data }, 502);
    }

    await admin.rpc("attach_djomy_reference", {
      _payment_id: payment.id,
      _transaction_id: txId,
      _redirect_url: redirectUrl,
    });

    return json({ paymentId: payment.id, transactionId: txId, redirectUrl });
  } catch (e) {
    console.error("[djomy-init-payment]", e);
    return json({ error: "INTERNAL", message: (e as Error).message }, 500);
  }
});