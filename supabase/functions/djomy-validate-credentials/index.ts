import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, djomyEnv, buildApiKeyHeader, json } from "../_shared/djomy.ts";

const BASE_URLS = {
  prod: "https://prod-api.djomy.africa",
  sandbox: "https://sandbox-api.djomy.africa",
} as const;

async function probe(baseUrl: string, apiKey: string) {
  const authUrl = `${baseUrl}/v1/auth`;
  const started = Date.now();
  try {
    const res = await fetch(authUrl, {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: "{}",
    });
    const latencyMs = Date.now() - started;
    const raw = await res.text();
    let parsed: unknown = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
    const data = (parsed && typeof parsed === "object") ? parsed as Record<string, unknown> : null;
    const token =
      (data?.accessToken as string | undefined) ??
      (data?.access_token as string | undefined) ??
      ((data?.data as Record<string, unknown> | undefined)?.accessToken as string | undefined) ??
      null;
    return {
      ok: res.ok,
      authUrl,
      status: res.status,
      latencyMs,
      response: parsed,
      tokenPreview: token ? `${token.slice(0, 10)}…` : null,
      expiresIn: (data?.expiresIn as number | undefined) ?? (data?.expires_in as number | undefined) ?? null,
    };
  } catch (e) {
    return {
      ok: false,
      authUrl,
      status: 0,
      latencyMs: Date.now() - started,
      response: null,
      tokenPreview: null,
      expiresIn: null,
      networkError: e instanceof Error ? e.message : String(e),
    };
  }
}

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

    // Diagnostics sur les secrets (sans jamais exposer la valeur)
    const idTrimmed = clientId.trim();
    const secretTrimmed = clientSecret.trim();
    const diagnostics = {
      activeEnv: env,
      clientIdPreview: `${clientId.slice(0, 4)}…${clientId.slice(-4)}`,
      clientIdLength: clientId.length,
      clientIdTrimmedLength: idTrimmed.length,
      clientIdHasWhitespace: idTrimmed.length !== clientId.length || /\s/.test(clientId),
      clientSecretLength: clientSecret.length,
      clientSecretTrimmedLength: secretTrimmed.length,
      clientSecretHasWhitespace: secretTrimmed.length !== clientSecret.length || /\s/.test(clientSecret),
    };

    // Probe les deux environnements en parallèle
    const [prod, sandbox] = await Promise.all([
      probe(BASE_URLS.prod, apiKey),
      probe(BASE_URLS.sandbox, apiKey),
    ]);

    // Verdict
    let verdict: string;
    if (diagnostics.clientIdHasWhitespace || diagnostics.clientSecretHasWhitespace) {
      verdict = "WHITESPACE_IN_SECRETS";
    } else if (prod.ok && sandbox.ok) {
      verdict = "BOTH_OK";
    } else if (prod.ok) {
      verdict = env === "prod" ? "OK_PROD" : "WRONG_ENV_SHOULD_BE_PROD";
    } else if (sandbox.ok) {
      verdict = env === "sandbox" ? "OK_SANDBOX" : "WRONG_ENV_SHOULD_BE_SANDBOX";
    } else {
      verdict = "BOTH_FAILED";
    }

    return json({
      ok: verdict === "BOTH_OK" || verdict === "OK_PROD" || verdict === "OK_SANDBOX",
      verdict,
      diagnostics,
      results: { prod, sandbox },
    });
  } catch (e) {
    return json({ ok: false, error: "UNEXPECTED", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});