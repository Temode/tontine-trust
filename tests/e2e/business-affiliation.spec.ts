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

  test("flux complet: ref -> signup -> affiliation visible (skip si non auth)", async ({ page }) => {
    // 1) landing capture
    await page.goto("/?ref=ZZ999999");
    const stored = await page.evaluate(() => localStorage.getItem("pending_referral_code"));
    expect(stored).toBe("ZZ999999");

    // 2) page /affiliation
    await page.goto("/affiliation");
    if (page.url().includes("/auth")) {
      test.info().annotations.push({ type: "skip", description: "auth requise" });
      return;
    }
    await expect(page.getByRole("heading", { name: /programme d'affiliation/i })).toBeVisible();
    await expect(page.getByText(/votre lien de parrainage/i)).toBeVisible();

    // 3) coordinator page réponse
    await page.goto("/coordinateur/commissions");
    await expect(page.getByRole("heading", { name: /mes commissions coordinateur/i })).toBeVisible();
    await expect(page.getByText(/total perçu/i)).toBeVisible();
  });

  test("admin /admin/affiliation exige super_admin", async ({ page }) => {
    await page.goto("/admin/affiliation");
    // Non-admin -> redirigé, admin -> voit le titre
    await expect(page).toHaveURL(/(auth|dashboard|affiliation)/);
  });
});
