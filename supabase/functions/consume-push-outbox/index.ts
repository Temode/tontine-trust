import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const FCM_KEY = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
  if (!LOVABLE_API_KEY || !FCM_KEY) return json({ skipped: "firebase_not_connected" });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: jobs, error } = await sb.rpc("push_outbox_pop", { _limit: 50 });
  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  for (const job of jobs ?? []) {
    const { data: tokens } = await sb.from("push_tokens").select("token").eq("user_id", job.user_id);
    // Écran d'appel natif : nom, photo et tontine de l'appelant.
    if (job.data?.kind === "call_incoming" && job.data?.call_id) {
      const { data: c } = await sb.from("call_requests")
        .select("group_id, requested_by, group:groups!call_requests_group_id_fkey(name)")
        .eq("id", job.data.call_id).maybeSingle();
      if (c) {
        const { data: p } = await sb.from("profiles").select("full_name, avatar_url").eq("id", c.requested_by).maybeSingle();
        const { data: dn } = await sb.rpc("member_display_name", { _name: p?.full_name ?? "" });
        const { data: turn } = await sb.from("next_turn_per_group")
          .select("beneficiary_name, payout_amount")
          .eq("group_id", c.group_id).maybeSingle();
        // Prénom seul ; jamais d'email. Sans tour exploitable, les champs sont omis et le natif masque la ligne.
        const first = typeof turn?.beneficiary_name === "string" && !turn.beneficiary_name.includes("@")
          ? turn.beneficiary_name.trim().split(/\s+/)[0] ?? "" : "";
        const amount = turn?.payout_amount;
        const turnFields = first && amount != null && Number(amount) > 0
          ? { turn_beneficiary_name: first, turn_payout_amount: String(amount) }
          : {};
        job.data = {
          ...job.data,
          group_id: c.group_id,
          group_name: (c as { group?: { name?: string } }).group?.name ?? "",
          // L'écran natif utilise la tontine si l'identité n'est pas connue.
          caller_name: typeof dn === "string" && dn.trim() && dn.trim().toLowerCase() !== "un membre" ? dn.trim() : "",
          caller_avatar_url: p?.avatar_url ?? "",
          ...turnFields,
        };
      }
    }
    let ok = false;
    let lastErr = "";
    for (const { token } of tokens ?? []) {
      const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": FCM_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          // Appels : message "data only" pour que l'app Android affiche l'écran
          // d'appel plein écran avec sonnerie continue (CallMessagingService natif).
          job.data?.kind === "call_incoming" || job.data?.kind === "call_cancel"
            ? {
                message: {
                  token,
                  data: {
                    ...Object.fromEntries(Object.entries(job.data ?? {}).map(([k, v]) => [k, String(v)])),
                    title: job.title ?? "",
                    body: job.body ?? "",
                  },
                  android: { priority: "HIGH", ttl: job.data?.kind === "call_incoming" ? "60s" : "120s" },
                  apns: { headers: { "apns-priority": "10" }, payload: { aps: { sound: "default", alert: { title: job.title, body: job.body ?? "" } } } },
                },
              }
            : {
          message: {
            token,
            notification: { title: job.title, body: job.body ?? "" },
            data: Object.fromEntries(Object.entries(job.data ?? {}).map(([k, v]) => [k, String(v)])),
            android: {
              priority: "HIGH",
              ...(job.data?.collapse_key ? { collapse_key: String(job.data.collapse_key).slice(0, 60) } : {}),
              notification: {
                channel_id: "tontine_alerts",
                color: "#0D7377",
                ...(job.data?.collapse_key ? { tag: String(job.data.collapse_key).slice(0, 60) } : {}),
                sound: "default",
                default_sound: true,
                default_vibrate_timings: true,
                notification_priority: "PRIORITY_HIGH",
                visibility: "PUBLIC",
              },
            },
            apns: { headers: { "apns-priority": "10" }, payload: { aps: { sound: "default" } } },
          },
        }),
      });
      if (res.ok) { ok = true; continue; }
      const txt = await res.text();
      lastErr = `[${res.status}] ${txt.slice(0, 300)}`;
      if (res.status === 404 || (res.status === 400 && txt.includes("INVALID_ARGUMENT")) || txt.includes("UNREGISTERED")) {
        await sb.from("push_tokens").delete().eq("token", token);
      }
    }
    await sb.from("push_outbox").update(
      ok ? { status: "sent", sent_at: new Date().toISOString(), last_error: null }
         : { status: job.attempts >= 3 ? "failed" : "pending", last_error: lastErr || "no_token" },
    ).eq("id", job.id);
    if (ok) sent++;
  }
  return json({ processed: jobs?.length ?? 0, sent });
});
