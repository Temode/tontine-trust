import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, djomyFetch, json, normalizePhone } from "../_shared/djomy.ts";

interface Body {
  groupId: string;
  amount: number;
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

    const amount = Math.floor(Number(body.amount));
    if (!body.groupId || !Number.isFinite(amount) || amount <= 0) {
      return json({ error: "INVALID_AMOUNT" }, 400);
    }
    if (!body.returnUrl || !/^https:\/\//.test(body.returnUrl)) {
      return json({
        error: "RETURN_URL_NOT_HTTPS",
        hint: "Djomy exige une returnUrl en HTTPS.",
      }, 400);
    }
    if (body.cancelUrl && !/^https:\/\//.test(body.cancelUrl)) {
      return json({ error: "CANCEL_URL_NOT_HTTPS" }, 400);
    }

    // 1. Crée le dépôt "pending" (RPC vérifie que la Solo appartient à l'utilisateur).
    const { data: rpc, error: rpcErr } = await userClient.rpc("start_solo_deposit", {
      _group_id: body.groupId,
      _amount: amount,
    });
    if (rpcErr) return json({ error: rpcErr.message }, 400);
    const depositId = (rpc as { deposit_id?: string } | null)?.deposit_id;
    if (!depositId) return json({ error: "DEPOSIT_NOT_CREATED" }, 500);

    const admin = createClient(url, serviceKey);
    const { data: prof } = await admin
      .from("profiles").select("phone_number").eq("id", u.user.id).maybeSingle();
    const phone = normalizePhone(prof?.phone_number ?? "00224000000000");

    // 2. Portail de paiement Djomy
    const djomyRes = await djomyFetch("/v1/payments/gateway", {
      method: "POST",
      body: {
        amount,
        countryCode: "GN",
        payerNumber: phone,
        allowedPaymentMethods: ["OM", "MOMO", "CARD"],
        description: `Dépôt épargne Solo (${depositId})`,
        merchantPaymentReference: depositId,
        returnUrl: body.returnUrl,
        cancelUrl: body.cancelUrl ?? body.returnUrl,
        metadata: {
          solo_deposit_id: depositId,
          group_id: body.groupId,
          purpose: "solo_deposit",
        },
      },
    });

    if (!djomyRes.ok) {
      await admin.from("solo_deposits")
        .update({ status: "failed" })
        .eq("id", depositId);
      return json({ error: "DJOMY_INIT_FAILED", details: djomyRes.data }, 502);
    }

    const d = djomyRes.data as Record<string, unknown> & { data?: Record<string, unknown> };
    const inner = (d.data as Record<string, unknown> | undefined) ?? d;
    const txId = (inner.transactionId as string) ?? (inner.transaction_id as string) ?? (inner.id as string) ?? "";
    const redirectUrl = (inner.redirectUrl as string) ?? (inner.paymentUrl as string) ?? (inner.url as string) ?? "";
    if (!redirectUrl) return json({ error: "DJOMY_NO_REDIRECT", details: djomyRes.data }, 502);

    await admin.from("solo_deposits")
      .update({ djomy_transaction_id: txId })
      .eq("id", depositId);

    return json({ depositId, transactionId: txId, redirectUrl });
  } catch (e) {
    console.error("[djomy-init-solo-deposit]", e);
    return json({ error: "INTERNAL", message: (e as Error).message }, 500);
  }
});
