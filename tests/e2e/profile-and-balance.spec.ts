/**
 * E2E : page Mon solde + photo de profil
 *  - vérifie que /solde s'ouvre sans crash (régression realtime "tontine-all")
 *  - vérifie qu'après upload d'avatar, l'URL signée est stockée et l'image visible
 */
import { test, expect } from "../../playwright-fixture";
import { FIXTURES } from "./fixtures/famille-alice";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
const SUPABASE_ANON = process.env.E2E_SUPABASE_ANON_KEY!;
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const BOB = FIXTURES.users.find((u) => u.email === "bob@test.local")!;

async function uiLogin(page: import("@playwright/test").Page) {
  await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
  await page.locator("input[type=email]").first().fill(BOB.email);
  await page.locator("input[type=password]").first().fill(FIXTURES.password);
  await page.getByRole("button", { name: /connecter|connexion/i }).first().click();
  await page.waitForLoadState("networkidle");
}

test.describe("Mon solde & avatar — E2E", () => {
  test("[@balance] /solde s'ouvre sans error boundary realtime", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await uiLogin(page);
    await page.goto(`${BASE_URL}/solde`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const body = (await page.locator("body").innerText()).toLowerCase();
    // L'erreur boundary l'aurait rendu visible avec ce texte exact
    expect(body).not.toContain("cannot add `postgres_changes`");
    expect(body).not.toContain("a rencontré un problème");
    // Marqueurs attendus de la page
    expect(body).toMatch(/solde|cagnotte|retrait/);
    // Pas d'erreur JS bloquante
    expect(errors.filter((e) => /postgres_changes/i.test(e))).toEqual([]);
  });

  test("[@avatar] upload de la photo de profil → URL signée stockée + image visible", async ({ page }) => {
    await uiLogin(page);
    await page.goto(`${BASE_URL}/profil`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // 1×1 PNG transparent
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    );

    const fileInput = page.locator('input[type=file]').first();
    await fileInput.setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: pngBytes });

    // attend la mise à jour
    await page.waitForTimeout(3500);

    // Vérifie côté DB : profiles.avatar_url contient une URL signée /object/sign/avatars/
    const loginR = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email: BOB.email, password: FIXTURES.password }),
    });
    const token = (await loginR.json()).access_token as string;
    const profR = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${BOB.id}&select=avatar_url`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` } },
    );
    const [{ avatar_url }] = (await profR.json()) as { avatar_url: string | null }[];
    expect(avatar_url ?? "").toMatch(/\/storage\/v1\/object\/sign\/avatars\/.+token=/);

    // Vérifie que l'image se charge (status 200) en HEAD
    const head = await fetch(avatar_url!, { method: "GET" });
    expect(head.status).toBe(200);

    // Le bouton "Réactiver mon avatar" est visible
    await expect(page.getByRole("button", { name: /Réactiver mon avatar/i })).toBeVisible();
  });
});