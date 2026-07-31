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
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
const SUPABASE_ANON = process.env.E2E_SUPABASE_ANON_KEY!;
const SUPABASE_SR = process.env.E2E_SUPABASE_SERVICE_ROLE!;

const USER = {
  id: "dddddddd-1111-4444-8888-000000000901",
  email: "call.persistence@test.local",
  password: "CallPersist1234!",
};

/** Crée (idempotent) l'utilisateur de test et renvoie une session Supabase. */
async function seedAndSignIn() {
  const admin = createClient(SUPABASE_URL, SUPABASE_SR, { auth: { persistSession: false } });
  await admin.auth.admin.deleteUser(USER.id).catch(() => undefined);
  const { error } = await admin.auth.admin.createUser({
    id: USER.id,
    email: USER.email,
    password: USER.password,
    email_confirm: true,
    user_metadata: { full_name: "Call Persistence", otp_verified: true },
  });
  if (error && !/already/i.test(error.message)) throw new Error(`seed user: ${error.message}`);

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });
  const { data, error: signInError } = await anon.auth.signInWithPassword({
    email: USER.email,
    password: USER.password,
  });
  if (signInError || !data.session) throw new Error(`sign in: ${signInError?.message}`);
  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  return { storageKey: `sb-${ref}-auth-token`, session: data.session };
}

/** Ouvre une route authentifiée avec la session injectée. */
async function gotoAuthenticated(page: Page, path: string) {
  const { storageKey, session } = await seedAndSignIn();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([k, v]) => window.localStorage.setItem(k, v),
    [storageKey, JSON.stringify(session)] as const,
  );
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
}

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
    await gotoAuthenticated(page, "/dashboard");
    await waitForCallApi(page);

    await page.evaluate(() =>
      window.__lovableCall!.startCall({ callId: "e2e-stub-route", groupName: "Route" }),
    );
    await expect(page.getByTestId("livekit-room-probe")).toBeAttached();
    expect((await counters(page)).mounts).toBe(1);

    // Réduction puis navigation SPA sur plusieurs routes
    await page.evaluate(() => window.__lovableCall!.minimize());
    for (const route of ["/groupes", "/discussions", "/profil", "/dashboard"]) {
      await page.evaluate((r) => window.history.pushState({}, "", r), route);
      await page.waitForTimeout(300);
      await expect(page.getByTestId("livekit-room-probe")).toBeAttached();
    }

    const c = await counters(page);
    expect(c.mounts).toBe(1);
    expect(c.unmounts).toBe(0);
  });

  test("survit aux bascules full ↔ mini ↔ pip", async ({ page }) => {
    await gotoAuthenticated(page, "/dashboard");
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
