import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, djomyFetch, json } from "../_shared/djomy.ts";

// Miroir de djomy-payment-status pour les abonnements.
// Force une réconciliation active du statut Djomy sans attendre le webhook.

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
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return json({ error: "INVALID_TOKEN" }, 401);

    const body = (await req.json().catch(() => ({}))) as {
      subscriptionId?: string;
      transactionId?: string;
    };
    if (!body.subscriptionId && !body.transactionId) {
      return json({ error: "MISSING_IDENTIFIER" }, 400);
    }

    const admin = createClient(url, serviceKey);
    const q = admin
      .from("user_subscriptions")
      .select("id, user_id, status, plan_code, djomy_ref, price_monthly")
      .limit(1);
    const { data: subRows } = body.subscriptionId
      ? await q.eq("id", body.subscriptionId)
      : await q.eq("djomy_ref", body.transactionId!);
    const sub = (subRows?.[0] as {
      id: string; user_id: string; status: string; plan_code: string;
      djomy_ref: string | null; price_monthly: number;
    } | undefined) ?? null;
    if (!sub) return json({ error: "SUBSCRIPTION_NOT_FOUND" }, 404);
    if (sub.user_id !== u.user.id) return json({ error: "FORBIDDEN" }, 403);

    // Statut déjà final : renvoi immédiat.
    if (["active", "trialing", "cancelled", "past_due"].includes(sub.status)) {
      return json({ subscriptionId: sub.id, status: sub.status });
    }

    const txId = sub.djomy_ref ?? body.transactionId;
    if (!txId) return json({ subscriptionId: sub.id, status: sub.status });

    const res = await djomyFetch(`/v1/payments/${encodeURIComponent(txId)}/status`);
    if (!res.ok) {
      console.warn("[djomy-subscription-status] djomy status not ok", { status: res.status });
      return json({ subscriptionId: sub.id, status: sub.status, djomy: res.data }, 200);
    }

    const d = res.data as Record<string, unknown> & { data?: Record<string, unknown> };
    const inner = (d.data as Record<string, unknown> | undefined) ?? d;
    const djomyStatus = String(inner.status ?? "").toUpperCase();
    const map: Record<string, string> = {
      SUCCESS: "succeeded", SUCCEEDED: "succeeded", PAID: "succeeded",
      FAILED: "failed", ERROR: "failed",
      CANCELLED: "cancelled", CANCELED: "cancelled",
      PENDING: "pending", INITIATED: "pending", REDIRECTED: "pending",
    };
    const mapped = map[djomyStatus];
    if (!mapped) return json({ subscriptionId: sub.id, status: sub.status });

    const { error: rpcErr } = await admin.rpc("apply_subscription_webhook", {
      _subscription_id: sub.id,
      _new_status: mapped,
      _djomy_ref: txId,
    });
    if (rpcErr) {
      console.error("[djomy-subscription-status] rpc error", rpcErr);
      return json({ error: rpcErr.message }, 500);
    }

    // Parité avec le webhook : commission d'affiliation sur succès.
    if (mapped === "succeeded") {
      const period = new Date().toISOString().slice(0, 7);
      const { error: refErr } = await admin.rpc("accrue_referral_earning", {
        _subscription_id: sub.id,
        _period: period,
      });
      if (refErr) console.warn("[djomy-subscription-status] accrue_referral_earning", refErr);
    }

    const finalStatus = mapped === "succeeded" ? "active"
      : mapped === "failed" ? "past_due"
      : mapped === "cancelled" ? "cancelled"
      : "pending";
    return json({ subscriptionId: sub.id, status: finalStatus });
  } catch (e) {
    console.error("[djomy-subscription-status]", e);
    return json({ error: "INTERNAL", message: (e as Error).message }, 500);
  }
});