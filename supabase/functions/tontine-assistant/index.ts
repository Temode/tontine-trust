/**
 * tontine-assistant — conseiller IA (Premium) d'une tontine.
 * POST { group_id, question } → flux texte. Lecture seule : ne déclenche aucune action.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { streamText } from "npm:ai@5";
import { createOpenAI } from "npm:@ai-sdk/openai@2";
import { z } from "npm:zod@3";

const RUN_ID = "X-Lovable-AIG-Run-ID";
const json = (p: unknown, s = 200) =>
  new Response(JSON.stringify(p), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({ group_id: z.string().uuid(), question: z.string().trim().min(1).max(1000) });

const SYSTEM = `Tu es le Conseiller de Tontine Digitale. Tu réponds en français simple, chaleureux et précis,
à un membre d'une tontine guinéenne. Tu t'appuies UNIQUEMENT sur les données JSON ci-dessous (règles du groupe,
calendrier, cotisations, solde et fiabilité du membre). Montants en GNF avec espaces (ex. 500 000 GNF), dates au format jj/mm/aaaa.
Si l'information manque, dis-le honnêtement et propose de contacter l'organisateur. Tu ne peux effectuer aucun paiement
ni modification : oriente vers les boutons de l'app. Ne révèle jamais d'informations personnelles d'autres membres.
Réponses courtes (5 phrases max sauf demande de détail).`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Non connecté" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Non connecté" }, 401);
    const uid = u.user.id;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Requête invalide" }, 400);
    const { group_id, question } = parsed.data;

    const { data: ent } = await userClient.rpc("get_my_entitlements");
    const e = ent as { plan_code?: string; status?: string } | null;
    if (!e || e.plan_code === "free" || !["active", "trialing"].includes(e.status ?? "")) {
      return json({ error: "L'assistant est réservé aux abonnés Premium.", code: "PREMIUM_REQUIRED" }, 403);
    }

    const { data: ctx, error: ctxErr } = await userClient.rpc("assistant_context", { p_group_id: group_id });
    if (ctxErr) return json({ error: "Vous n'êtes pas membre actif de ce groupe." }, 403);

    const { data: hist } = await admin.from("group_assistant_messages")
      .select("role, content").eq("group_id", group_id).eq("user_id", uid)
      .order("created_at", { ascending: false }).limit(12);
    const history = (hist ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const { error: insErr } = await admin.from("group_assistant_messages")
      .insert({ group_id, user_id: uid, role: "user", content: question });
    if (insErr) return json({ error: "Enregistrement impossible" }, 500);

    let runId: string | undefined;
    const openai = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: "unused",
      headers: { "Lovable-API-Key": Deno.env.get("LOVABLE_API_KEY") ?? "", "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: async (input, init) => {
        const h = new Headers(init?.headers);
        if (runId) h.set(RUN_ID, runId);
        const r = await fetch(input, { ...init, headers: h });
        runId ??= r.headers.get(RUN_ID) ?? undefined;
        if (!r.ok) {
          const t = await r.clone().text();
          console.error("[assistant] gateway", r.status, t.slice(0, 300));
        }
        return r;
      },
    });

    const result = streamText({
      model: openai.responses("openai/gpt-6-astra"),
      system: `${SYSTEM}\n\nDONNÉES:\n${JSON.stringify(ctx)}`,
      messages: [...history, { role: "user", content: question }],
      abortSignal: req.signal,
      providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", store: false } },
      onFinish: async ({ text }) => {
        if (!text) return;
        const { error } = await admin.from("group_assistant_messages")
          .insert({ group_id, user_id: uid, role: "assistant", content: text });
        if (error) console.error("[assistant] save", error.message);
      },
      onError: ({ error }) => console.error("[assistant] stream", error),
    });
    return result.toTextStreamResponse({ headers: corsHeaders });
  } catch (err) {
    console.error("[assistant]", err);
    return json({ error: "Erreur du serveur" }, 500);
  }
});
