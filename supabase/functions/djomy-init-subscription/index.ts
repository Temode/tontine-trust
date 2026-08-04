import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, djomyFetch, json } from "../_shared/djomy.ts";

interface Body {
  planCode: "premium" | "business";
  tierOptions?: Record<string, number>;
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
    if (!body.planCode || !body.returnUrl) return json({ error: "MISSING_FIELDS" }, 400);
    if (!["premium", "business"].includes(body.planCode)) return json({ error: "INVALID_PLAN" }, 400);
    if (!/^https:\/\//.test(body.returnUrl)) return json({ error: "RETURN_URL_NOT_HTTPS" }, 400);

    const { data: subRow, error: startErr } = await userClient.rpc("start_subscription_checkout", {
      _plan_code: body.planCode,
      _tier_options: body.tierOptions ?? {},
    });
    if (startErr) return json({ error: startErr.message }, 400);
    const sub = subRow as { id: string; price_monthly: number; plan_code: string };
    if (!sub?.id) return json({ error: "SUBSCRIPTION_CREATE_FAILED" }, 500);

    const admin = createClient(url, serviceKey);
    const amount = Number(sub.price_monthly);
    if (!amount || amount <= 0) return json({ error: "INVALID_AMOUNT" }, 400);

    // Djomy exige payerNumber. On récupère celui du profil s'il existe,
    // sinon on envoie un placeholder valide (l'utilisateur pourra le corriger
    // sur l'écran Djomy). Même logique que djomy-init-payment / cotisations.
    let payerNumber = "00224000000000";
    try {
      const { data: prof } = await admin
        .from("profiles")
        .select("phone_number")
        .eq("id", u.user.id)
        .maybeSingle();
      const p = (prof as { phone_number?: string | null } | null)?.phone_number;
      if (p && p.trim().length >= 8) payerNumber = p.trim();
    } catch (_) { /* profil optionnel */ }

    console.log("[djomy-init-subscription] init", {
      subscriptionId: sub.id, planCode: sub.plan_code, amount, hasPhone: payerNumber !== "00224000000000",
    });

    const djomyRes = await djomyFetch("/v1/payments/gateway", {
      method: "POST",
      body: {
        amount,
        countryCode: "GN",
        payerNumber,
        allowedPaymentMethods: ["OM", "MOMO", "CARD"],
        description: `Abonnement Tontine Digital ${sub.plan_code} (${sub.id})`,
        merchantPaymentReference: sub.id,
        returnUrl: body.returnUrl,
        cancelUrl: body.cancelUrl ?? body.returnUrl,
        metadata: {
          subscription_id: sub.id,
          plan_code: sub.plan_code,
          purpose: "subscription",
        },
      },
    });

    console.log("[djomy-init-subscription] djomy response", {
      status: djomyRes.status, ok: djomyRes.ok, raw: djomyRes.raw?.slice?.(0, 500),
    });

    if (!djomyRes.ok) {
      await admin.rpc("apply_subscription_webhook", {
        _subscription_id: sub.id,
        _new_status: "failed",
        _djomy_ref: null,
      });
      return json({ error: "DJOMY_INIT_FAILED", status: djomyRes.status, details: djomyRes.data ?? djomyRes.raw }, 502);
    }

    const d = djomyRes.data as Record<string, unknown> & { data?: Record<string, unknown> };
    const inner = (d.data as Record<string, unknown> | undefined) ?? d;
    const txId = (inner.transactionId as string) ?? (inner.transaction_id as string) ?? (inner.id as string) ?? "";
    const redirectUrl = (inner.redirectUrl as string) ?? (inner.paymentUrl as string) ?? (inner.url as string) ?? "";
    if (!redirectUrl) return json({ error: "DJOMY_NO_REDIRECT", details: djomyRes.data }, 502);

    await admin.from("user_subscriptions").update({ djomy_ref: txId }).eq("id", sub.id);

    return json({ subscriptionId: sub.id, transactionId: txId, redirectUrl });
  } catch (e) {
    console.error("[djomy-init-subscription]", e);
    return json({ error: "INTERNAL", message: (e as Error).message }, 500);
  }
});