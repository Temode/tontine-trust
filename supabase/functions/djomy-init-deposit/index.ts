import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, djomyFetch, json, normalizePhone } from "../_shared/djomy.ts";

interface Body {
  groupId: string;
  method?: "OM" | "MOMO" | "CARD";
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

    if (!body.groupId || !body.payerPhone || !body.returnUrl) {
      return json({ error: "MISSING_FIELDS" }, 400);
    }
    if (body.method && !["OM", "MOMO", "CARD"].includes(body.method)) {
      return json({ error: "INVALID_METHOD" }, 400);
    }
    if (!/^https:\/\//.test(body.returnUrl)) {
      return json({ error: "RETURN_URL_NOT_HTTPS" }, 400);
    }
    if (body.cancelUrl && !/^https:\/\//.test(body.cancelUrl)) {
      return json({ error: "CANCEL_URL_NOT_HTTPS" }, 400);
    }

    const phone = normalizePhone(body.payerPhone);

    // 1. Crée/réutilise la caution en attente
    const { data: startRes, error: rpcErr } = await userClient.rpc("start_member_deposit", {
      _group_id: body.groupId,
      _payer_phone: phone,
    });
    if (rpcErr) return json({ error: rpcErr.message }, 400);
    const start = startRes as { deposit_id: string; amount: number; months: number };
    if (!start?.deposit_id) return json({ error: "DEPOSIT_INIT_FAILED" }, 500);

    const admin = createClient(url, serviceKey);
    const allowedPaymentMethods = body.method ? [body.method] : ["OM", "MOMO", "CARD"];

    const djomyRes = await djomyFetch("/v1/payments/gateway", {
      method: "POST",
      body: {
        amount: Number(start.amount),
        countryCode: "GN",
        payerNumber: phone,
        allowedPaymentMethods,
        description: `Caution tontine (${start.months} mois) — dépôt ${start.deposit_id}`,
        merchantPaymentReference: start.deposit_id,
        returnUrl: body.returnUrl,
        cancelUrl: body.cancelUrl ?? body.returnUrl,
        metadata: {
          deposit_id: start.deposit_id,
          group_id: body.groupId,
          user_id: u.user.id,
          purpose: "deposit",
        },
      },
    });
    console.log("[djomy-init-deposit]", { status: djomyRes.status, raw: djomyRes.raw.slice(0, 400) });

    if (!djomyRes.ok) {
      await admin.from("member_deposits")
        .update({ status: "failed" })
        .eq("id", start.deposit_id);
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

    if (!redirectUrl) return json({ error: "DJOMY_NO_REDIRECT", details: djomyRes.data }, 502);

    await admin.rpc("attach_deposit_djomy_reference", {
      _deposit_id: start.deposit_id,
      _transaction_id: txId,
      _redirect_url: redirectUrl,
    });

    return json({
      depositId: start.deposit_id,
      amount: start.amount,
      months: start.months,
      transactionId: txId,
      redirectUrl,
    });
  } catch (e) {
    console.error("[djomy-init-deposit]", e);
    return json({ error: "INTERNAL", message: (e as Error).message }, 500);
  }
});