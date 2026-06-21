import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, djomyBaseUrl, djomyEnv, buildApiKeyHeader, json } from "../_shared/djomy.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ ok: false, error: "UNAUTHENTICATED" }, 401);

    const { data: isSuper, error: rolesErr } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "super_admin",
    });
    if (rolesErr) return json({ ok: false, error: "ROLE_CHECK_FAILED", detail: rolesErr.message }, 500);
    if (!isSuper) return json({ ok: false, error: "FORBIDDEN" }, 403);

    const clientId = Deno.env.get("DJOMY_CLIENT_ID");
    const clientSecret = Deno.env.get("DJOMY_CLIENT_SECRET");
    const env = djomyEnv();

    if (!clientId || !clientSecret) {
      return json({
        ok: false,
        env,
        error: "CREDENTIALS_MISSING",
        message: "DJOMY_CLIENT_ID ou DJOMY_CLIENT_SECRET non configuré.",
      });
    }

    const apiKey = await buildApiKeyHeader();
    const authUrl = `${djomyBaseUrl()}/v1/auth`;
    const started = Date.now();
    const res = await fetch(authUrl, {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: "{}",
    });
    const latencyMs = Date.now() - started;
    const raw = await res.text();
    let parsed: unknown = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }

    if (!res.ok) {
      return json({
        ok: false,
        env,
        authUrl,
        status: res.status,
        latencyMs,
        clientIdPreview: `${clientId.slice(0, 4)}…${clientId.slice(-4)} (${clientId.length} car.)`,
        clientSecretLength: clientSecret.length,
        response: parsed,
        error: "DJOMY_AUTH_FAILED",
      });
    }

    const data = parsed as Record<string, unknown> | null;
    const token =
      (data?.accessToken as string | undefined) ??
      (data?.access_token as string | undefined) ??
      ((data?.data as Record<string, unknown> | undefined)?.accessToken as string | undefined);

    return json({
      ok: true,
      env,
      authUrl,
      status: res.status,
      latencyMs,
      clientIdPreview: `${clientId.slice(0, 4)}…${clientId.slice(-4)} (${clientId.length} car.)`,
      clientSecretLength: clientSecret.length,
      tokenPreview: token ? `${token.slice(0, 10)}…` : null,
      expiresIn: (data?.expiresIn as number | undefined) ?? (data?.expires_in as number | undefined) ?? null,
    });
  } catch (e) {
    return json({ ok: false, error: "UNEXPECTED", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});