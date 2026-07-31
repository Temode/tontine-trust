/**
 * E2E [@calls] — persistance du <LiveKitRoom>
 *
 * Vérifie que le sous-arbre LiveKit monté par le CallProvider global n'est
 * JAMAIS démonté :
 *  1. lors des changements de route (navigation SPA) ;
 *  2. lors des bascules full ↔ mini ↔ pip.
 *
 * L'appel est démarré en mode bouchon (`e2e-stub-*`) : le provider saute la
 * demande de token et monte <LiveKitRoom connect={false}>, ce qui teste la
 * structure de l'arbre React sans dépendre d'un serveur LiveKit.
 *
 * Sondes exposées par le provider (dev only) :
 *  - window.__livekitRoomMounts / __livekitRoomUnmounts
 *  - window.__lovableCall = { startCall, minimize, expand, hangup }
 */
import { test, expect, type Page } from "../../playwright-fixture";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8080";

type CallApi = {
  startCall: (args: { callId: string; groupName?: string }) => void;
  minimize: () => void;
  expand: () => void;
  hangup: () => void;
};

declare global {
  interface Window {
    __livekitRoomMounts?: number;
    __livekitRoomUnmounts?: number;
    __lovableCall?: CallApi;
  }
}

async function counters(page: Page) {
  return page.evaluate(() => ({
    mounts: window.__livekitRoomMounts ?? 0,
    unmounts: window.__livekitRoomUnmounts ?? 0,
  }));
}

async function waitForCallApi(page: Page) {
  await page.waitForFunction(() => !!window.__lovableCall, null, { timeout: 15000 });
}

test.describe("@calls persistance du LiveKitRoom", () => {
  test("survit aux changements de route", async ({ page }) => {
    await page.goto(`${BASE}/`);
    await waitForCallApi(page);

    await page.evaluate(() =>
      window.__lovableCall!.startCall({ callId: "e2e-stub-route", groupName: "Route" }),
    );
    await expect(page.getByTestId("livekit-room-probe")).toBeAttached();
    expect((await counters(page)).mounts).toBe(1);

    // Réduction puis navigation SPA sur plusieurs routes
    await page.evaluate(() => window.__lovableCall!.minimize());
    for (const route of ["/mes-groupes", "/messages", "/profil", "/"]) {
      await page.evaluate((r) => window.history.pushState({}, "", r), route);
      await page.waitForTimeout(300);
      await expect(page.getByTestId("livekit-room-probe")).toBeAttached();
    }

    const c = await counters(page);
    expect(c.mounts).toBe(1);
    expect(c.unmounts).toBe(0);
  });

  test("survit aux bascules full ↔ mini ↔ pip", async ({ page }) => {
    await page.goto(`${BASE}/`);
    await waitForCallApi(page);

    await page.evaluate(() =>
      window.__lovableCall!.startCall({ callId: "e2e-stub-modes", groupName: "Modes" }),
    );
    await expect(page.getByTestId("livekit-room-probe")).toBeAttached();

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.__lovableCall!.minimize());
      await expect(page.getByTestId("call-active-banner")).toBeVisible();
      await page.evaluate(() => window.__lovableCall!.expand());
      await page.waitForTimeout(150);
    }

    // Bascule PiP simulée : le navigateur headless peut refuser le PiP natif,
    // on émet les évènements que le provider écoute pour changer de mode.
    await page.evaluate(() => {
      document.dispatchEvent(new Event("enterpictureinpicture", { bubbles: true }));
    });
    await page.waitForTimeout(150);
    await expect(page.getByTestId("livekit-room-probe")).toBeAttached();
    await page.evaluate(() => {
      document.dispatchEvent(new Event("leavepictureinpicture", { bubbles: true }));
    });
    await page.waitForTimeout(150);

    const c = await counters(page);
    expect(c.mounts).toBe(1);
    expect(c.unmounts).toBe(0);

    await page.evaluate(() => window.__lovableCall!.hangup());
    await expect(page.getByTestId("livekit-room-probe")).toHaveCount(0);
    expect((await counters(page)).unmounts).toBe(1);
  });
});
