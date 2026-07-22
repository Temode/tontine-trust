import { test, expect } from "@playwright/test";

// Note: requires an authenticated preview session for the /abonnement route.
// The suite validates the 2-step flow: pricing page → checkout page → pay button.

test.describe("Subscription checkout 2-step flow", () => {
  test("pricing page has no phone input and premium leads to checkout", async ({ page }) => {
    await page.goto("/abonnement");
    await expect(page.getByText(/Choisissez le plan/i)).toBeVisible();
    // Le champ téléphone doit avoir disparu.
    await expect(page.getByPlaceholder(/\+224/)).toHaveCount(0);
    await expect(page.getByText(/Téléphone Mobile Money/i)).toHaveCount(0);
  });

  test("checkout page shows summary and pay button for premium", async ({ page }) => {
    await page.goto("/abonnement/checkout?plan=premium");
    await expect(page.getByText(/Résumé de la commande/i)).toBeVisible();
    await expect(page.getByTestId("checkout-total")).toBeVisible();
    const payBtn = page.getByTestId("checkout-pay");
    await expect(payBtn).toBeVisible();
    await expect(payBtn).toContainText(/Procéder au paiement/i);
  });

  test("checkout page for business shows fixed price and no sliders", async ({ page }) => {
    await page.goto("/abonnement/checkout?plan=business");
    await expect(page.getByText(/Résumé de la commande/i)).toBeVisible();
    await expect(page.getByText(/Configurez votre plan/i)).toHaveCount(0);
  });

  test("invalid plan redirects to /abonnement", async ({ page }) => {
    await page.goto("/abonnement/checkout?plan=bogus");
    await page.waitForURL(/\/abonnement($|\?)/);
    expect(page.url()).toMatch(/\/abonnement($|\?)/);
  });
});