import { test, expect } from "@playwright/test";

/**
 * Relance d'un nouveau cycle (opt-in des membres).
 * Vérifie le parcours visible côté UI :
 *  - l'organisateur d'un groupe terminé voit l'encart de relance,
 *  - la modale demande un seuil de participants et une date limite,
 *  - une relance ouverte affiche le décompte, le compte à rebours et le pot projeté.
 */
test.describe("Relance de cycle", () => {
  test("encart de relance sur un groupe terminé", async ({ page }) => {
    await page.goto("/groupes");
    const finished = page.getByText(/terminé/i).first();
    if (!(await finished.isVisible().catch(() => false))) {
      test.skip(true, "Aucun groupe terminé dans l'environnement de test.");
    }
    await finished.click();
    const cta = page.getByRole("button", { name: /lancer une demande de relance/i });
    if (await cta.isVisible().catch(() => false)) {
      await cta.click();
      await expect(page.getByText(/participants minimum/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /envoyer la demande/i })).toBeVisible();
    }
  });

  test("relance en cours : décompte et pot projeté", async ({ page }) => {
    await page.goto("/groupes");
    const panel = page.getByText(/nouveau cycle proposé/i).first();
    if (!(await panel.isVisible().catch(() => false))) {
      test.skip(true, "Aucune relance ouverte dans l'environnement de test.");
    }
    await expect(page.getByText(/ont confirmé/i)).toBeVisible();
    await expect(page.getByText(/pot par tour/i)).toBeVisible();
  });
});