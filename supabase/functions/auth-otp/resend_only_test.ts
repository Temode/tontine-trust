// Deno test — garantit que l'edge function `auth-otp` :
// 1. n'utilise QUE la gateway Resend pour envoyer les e-mails d'auth,
// 2. force l'expéditeur `noreply@tontinedigitale.com`,
// 3. ne contient aucune référence à un émetteur natif Supabase / Lovable
//    (`no-reply@auth.lovable.cloud`, `onboarding@resend.dev`, `supabase.auth.signUp`,
//    `resetPasswordForEmail`, `inviteUserByEmail`, `signInWithOtp`).
//
// Ce test échoue à la moindre régression réintroduisant un chemin d'envoi
// hors Resend / hors domaine Tontine Digitale.

import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SOURCE_URL = new URL("./index.ts", import.meta.url);
const source = await Deno.readTextFile(SOURCE_URL);
const projectRoot = new URL("../../../", import.meta.url);

async function collectProjectFiles(dir: URL, files: string[] = []): Promise<string[]> {
  for await (const entry of Deno.readDir(dir)) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === "dist" ||
      entry.name === "build"
    ) continue;

    const child = new URL(`${entry.name}${entry.isDirectory ? "/" : ""}`, dir);
    if (entry.isDirectory) {
      await collectProjectFiles(child, files);
      continue;
    }

    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(child.pathname);
    }
  }
  return files;
}

Deno.test("auth-otp: expéditeur figé sur noreply@tontinedigitale.com", () => {
  assertStringIncludes(source, 'const FROM_EMAIL = "noreply@tontinedigitale.com"');
  assertStringIncludes(source, 'const ALLOWED_FROM_DOMAIN = "tontinedigitale.com"');
});

Deno.test("auth-otp: gateway Resend est le seul endpoint d'envoi", () => {
  assertStringIncludes(
    source,
    'const RESEND_GATEWAY_URL = "https://connector-gateway.lovable.dev/resend/emails"',
  );
  // Un seul appel `fetch(` dans le module, vers RESEND_GATEWAY_URL.
  const fetches = source.match(/fetch\(/g) ?? [];
  assertEquals(fetches.length, 1, "un seul appel réseau attendu (Resend)");
  assertStringIncludes(source, "fetch(RESEND_GATEWAY_URL");
});

Deno.test("auth-otp: aucun émetteur ou API auth-mail interdit", () => {
  const forbidden = [
    "no-reply@auth.lovable.cloud",
    "noreply@auth.lovable.cloud",
    "onboarding@resend.dev",
    "supabase.auth.signUp",
    "resetPasswordForEmail",
    "inviteUserByEmail",
    "signInWithOtp",
    "generateLink",
  ];
  for (const needle of forbidden) {
    assert(
      !source.includes(needle),
      `Référence interdite détectée dans auth-otp/index.ts: "${needle}"`,
    );
  }
});

Deno.test("auth-otp: le body Resend passe explicitement `from: FROM_ADDRESS`", () => {
  assertStringIncludes(source, "from: FROM_ADDRESS");
  assertStringIncludes(source, 'const FROM_ADDRESS = `Tontine Digitale <${FROM_EMAIL}>`');
});

Deno.test("auth-otp: création utilisateur n'enclenche pas d'e-mail natif Supabase", () => {
  // `email_confirm: true` supprime l'envoi automatique par Supabase à la création.
  assertStringIncludes(source, "email_confirm: true");
  assert(
    !/email_confirm:\s*false/.test(source),
    "email_confirm: false réintroduit l'e-mail natif Supabase",
  );
});

Deno.test("projet: aucun flux frontend/backend ne déclenche d'e-mail auth natif", async () => {
  const forbiddenPatterns: Array<[RegExp, string]> = [
    [/\.auth\.signUp\s*\(/, "auth.signUp"],
    [/\.signUp\s*\(/, "signUp natif"],
    [/resetPasswordForEmail\s*\(/, "resetPasswordForEmail"],
    [/signInWithOtp\s*\(/, "signInWithOtp"],
    [/generateLink\s*\(/, "generateLink"],
    [/inviteUserByEmail\s*\(/, "inviteUserByEmail"],
    [/\/signup["'`]/, "endpoint /signup natif"],
    [/\/recover["'`]/, "endpoint /recover natif"],
  ];
  const allowedFiles = new Set([
    new URL("./resend_only_test.ts", import.meta.url).pathname,
    new URL("../../../src/hooks/useAuth.tsx", import.meta.url).pathname,
    new URL("../../../src/pages/Auth.tsx", import.meta.url).pathname,
  ]);

  const files = await collectProjectFiles(projectRoot);
  const violations: string[] = [];
  for (const file of files) {
    if (allowedFiles.has(file)) continue;
    const text = await Deno.readTextFile(file);
    for (const [pattern, label] of forbiddenPatterns) {
      if (pattern.test(text)) {
        violations.push(`${file.replace(projectRoot.pathname, "")}: ${label}`);
      }
    }
  }

  assertEquals(
    violations,
    [],
    `Des appels auth natifs peuvent envoyer des e-mails Lovable au lieu de Resend:\n${violations.join("\n")}`,
  );
});