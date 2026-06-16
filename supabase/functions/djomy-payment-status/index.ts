import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, djomyFetch, json } from "../_shared/djomy.ts";

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

    const { transactionId } = (await req.json().catch(() => ({}))) as { transactionId?: string };
    if (!transactionId) return json({ error: "MISSING_TRANSACTION_ID" }, 400);

    const admin = createClient(url, serviceKey);
    const { data: payment } = await admin
      .from("payments")
      .select("id, user_id, status, contribution_id, amount, payment_method")
      .eq("djomy_transaction_id", transactionId)
      .single();
    if (!payment) return json({ error: "PAYMENT_NOT_FOUND" }, 404);
    if (payment.user_id !== u.user.id) return json({ error: "FORBIDDEN" }, 403);

    // Si déjà confirmé en local, retour immédiat
    if (payment.status === "succeeded" || payment.status === "failed" || payment.status === "cancelled") {
      return json({ status: payment.status, paymentId: payment.id });
    }

    const res = await djomyFetch(`/v1/payments/${encodeURIComponent(transactionId)}/status`);
    if (!res.ok) return json({ status: payment.status, paymentId: payment.id, djomy: res.data }, 200);

    const d = (res.data as Record<string, unknown> & { data?: Record<string, unknown> });
    const inner = (d.data as Record<string, unknown> | undefined) ?? d;
    const djomyStatus = String(inner.status ?? "").toUpperCase();
    const map: Record<string, string> = {
      SUCCESS: "succeeded", SUCCEEDED: "succeeded",
      FAILED: "failed", ERROR: "failed",
      CANCELLED: "cancelled", CANCELED: "cancelled",
      PENDING: "pending", INITIATED: "pending", REDIRECTED: "pending",
    };
    const mapped = map[djomyStatus];
    if (mapped && mapped !== payment.status) {
      await admin.rpc("apply_djomy_webhook", {
        _payment_id: payment.id,
        _new_status: mapped,
        _provider_ref: transactionId,
        _paid_amount: Number(inner.paidAmount ?? payment.amount),
        _payment_method: (inner.paymentMethod as string) ?? payment.payment_method ?? null,
      });
      return json({ status: mapped, paymentId: payment.id });
    }
    return json({ status: payment.status, paymentId: payment.id });
  } catch (e) {
    console.error("[djomy-payment-status]", e);
    return json({ error: "INTERNAL", message: (e as Error).message }, 500);
  }
});