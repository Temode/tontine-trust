// Rejoue manuellement la mise à jour d'un payment, réservé aux super_admin.
// N'expose JAMAIS DJOMY_WEBHOOK_SECRET : on appelle directement la RPC SECURITY DEFINER
// `apply_djomy_webhook`, comme le ferait djomy-webhook après vérification de signature.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Body {
  paymentId: string;
  status: "succeeded" | "failed" | "cancelled" | "pending";
  paidAmount?: number;
  paymentMethod?: string | null;
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

    // Vérification super_admin via la RPC has_role (SECURITY DEFINER)
    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: u.user.id,
      _role: "super_admin",
    });
    if (roleErr) return json({ error: "ROLE_CHECK_FAILED", message: roleErr.message }, 500);
    if (!isAdmin) return json({ error: "FORBIDDEN", hint: "super_admin requis" }, 403);

    let body: Body;
    try { body = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
    if (!body.paymentId) return json({ error: "MISSING_PAYMENT_ID" }, 400);
    if (!["succeeded", "failed", "cancelled", "pending"].includes(body.status)) {
      return json({ error: "INVALID_STATUS" }, 400);
    }

    const admin = createClient(url, serviceKey);

    // Charge le payment pour récupérer montant + provider_ref
    const { data: payment, error: pErr } = await admin
      .from("payments")
      .select("id, amount, djomy_transaction_id, status")
      .eq("id", body.paymentId)
      .maybeSingle();
    if (pErr || !payment) return json({ error: "PAYMENT_NOT_FOUND" }, 404);

    const providerRef = payment.djomy_transaction_id ?? `replay-${crypto.randomUUID()}`;
    const fakeEventId = `replay-${crypto.randomUUID()}`;

    // Trace dans djomy_webhook_events (marqué signature_valid=false pour distinguer)
    await admin.from("djomy_webhook_events").insert({
      event_id: fakeEventId,
      event_type: `admin.replay.${body.status}`,
      transaction_id: providerRef,
      signature_valid: false,
      payload: { source: "admin-replay", actor: u.user.id, ...body },
    });

    const { error: rpcErr } = await admin.rpc("apply_djomy_webhook", {
      _payment_id: payment.id,
      _new_status: body.status,
      _provider_ref: providerRef,
      _paid_amount: Number(body.paidAmount ?? payment.amount ?? 0),
      _payment_method: body.paymentMethod ?? "ADMIN_REPLAY",
    });
    if (rpcErr) {
      return json({
        error: "RPC_FAILED",
        message: rpcErr.message,
        details: rpcErr.details ?? null,
        hint: rpcErr.hint ?? null,
        code: rpcErr.code ?? null,
      }, 500);
    }

    return json({ ok: true, paymentId: payment.id, status: body.status });
  } catch (e) {
    console.error("[djomy-admin-replay]", e);
    return json({ error: "INTERNAL", message: (e as Error).message }, 500);
  }
});
