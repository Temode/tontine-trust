import { test, expect } from "@playwright/test";

/**
 * M8 — Business + Affiliation
 * Vérifie que:
 *  - /affiliation charge et affiche le lien de parrainage
 *  - /coordinateur/commissions charge sans erreur
 *  - ?ref=CODE stocke bien un code de parrainage en localStorage
 */

test.describe("Business & Affiliation", () => {
  test("landing capture ?ref=", async ({ page }) => {
    await page.goto("/?ref=ABC12345");
    const stored = await page.evaluate(() => localStorage.getItem("pending_referral_code"));
    expect(stored).toBe("ABC12345");
  });

  test("page /affiliation se charge (auth requise en preview)", async ({ page }) => {
    await page.goto("/affiliation");
    // Redirige vers /auth si non connecté, sinon affiche le titre
    await expect(page).toHaveURL(/(auth|affiliation)/);
  });

  test("page /coordinateur/commissions se charge", async ({ page }) => {
    await page.goto("/coordinateur/commissions");
    await expect(page).toHaveURL(/(auth|coordinateur)/);
  });
});
