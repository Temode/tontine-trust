/**
 * E2E [@auth] — Comptes legacy non vérifiés.
 *
 * Vérifie qu'un utilisateur existant dont `user_metadata.otp_verified !== true` :
 *  1. est intercepté au login (pas de session, pas d'erreur générique),
 *  2. déclenche un envoi Resend via `auth-otp` (action=signup_resend, trigger=legacy_login),
 *  3. est redirigé vers /auth/verifier-email avec le bandeau explicatif.
 *
 * L'envoi passe UNIQUEMENT par l'edge function `auth-otp` (aucun appel /auth/v1/signup).
 */
import { test, expect } from "../../playwright-fixture";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
const SUPABASE_ANON = process.env.E2E_SUPABASE_ANON_KEY!;
const SUPABASE_SR = process.env.E2E_SUPABASE_SERVICE_ROLE!;
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8080";

const LEGACY_USER = {
  id: "cccccccc-1111-4444-8888-000000000001",
  email: "legacy.unverified@test.local",
  password: "Legacy1234!",
  fullName: "Legacy Unverified",
};

async function seedLegacyUser() {
  const admin = createClient(SUPABASE_URL, SUPABASE_SR, { auth: { persistSession: false } });
  // (Re)crée l'utilisateur avec otp_verified: false pour simuler un compte
  // antérieur à la mise en place de la vérification obligatoire.
  await admin.auth.admin.deleteUser(LEGACY_USER.id).catch(() => undefined);
  const { error } = await admin.auth.admin.createUser({
    id: LEGACY_USER.id,
    email: LEGACY_USER.email,
    password: LEGACY_USER.password,
    email_confirm: true,
    user_metadata: { full_name: LEGACY_USER.fullName, otp_verified: false },
  });
  if (error) throw new Error(`seed legacy user: ${error.message}`);
  // Purge les anciennes OTP pour un run reproductible.
  await admin.from("auth_otp_requests").delete().eq("email", LEGACY_USER.email);
}

test.describe("@auth legacy unverified account", () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_ANON || !SUPABASE_SR,
    "E2E_SUPABASE_URL / _ANON_KEY / _SERVICE_ROLE requis",
  );

  test.beforeAll(async () => {
    await seedLegacyUser();
  });

  test("login legacy → interception + resend automatique + redirection", async ({ page }) => {
    const nativeSignupCalls: string[] = [];
    const authOtpCalls: Array<{ url: string; body: string }> = [];

    page.on("request", (req) => {
      const url = req.url();
      if (/\/auth\/v1\/signup(\?|$)/.test(url)) nativeSignupCalls.push(url);
      if (/\/functions\/v1\/auth-otp(\?|$)/.test(url)) {
        authOtpCalls.push({ url, body: req.postData() ?? "" });
      }
    });

    await page.goto(`${BASE_URL}/auth`);
    await page.getByLabel("Email").fill(LEGACY_USER.email);
    await page.getByLabel("Mot de passe").fill(LEGACY_USER.password);
    await page.getByRole("button", { name: /se connecter/i }).click();

    // Redirection vers la page de vérification.
    await page.waitForURL(/\/auth\/verifier-email/, { timeout: 15_000 });

    // Bandeau d'information "Vérification e-mail requise".
    await expect(
      page.getByText(/Vérification e-mail requise|Accès administrateur bloqué/i),
    ).toBeVisible({ timeout: 5_000 });

    // Aucun appel natif /auth/v1/signup.
    expect(nativeSignupCalls).toEqual([]);

    // Au moins un appel à auth-otp avec action=signup_resend + trigger=legacy_login.
    const legacyResend = authOtpCalls.find((c) => {
      try {
        const parsed = JSON.parse(c.body);
        return parsed.action === "signup_resend" && parsed.trigger === "legacy_login";
      } catch {
        return false;
      }
    });
    expect(legacyResend, "auth-otp signup_resend legacy_login absent").toBeTruthy();

    // Une ligne journalisée côté DB avec trigger_source=signup_resend_legacy_login.
    const admin = createClient(SUPABASE_URL, SUPABASE_SR, { auth: { persistSession: false } });
    const { data } = await admin
      .from("auth_otp_requests")
      .select("trigger_source, status")
      .eq("email", LEGACY_USER.email)
      .order("created_at", { ascending: false })
      .limit(1);
    expect(data?.[0]?.trigger_source).toBe("signup_resend_legacy_login");
  });
});