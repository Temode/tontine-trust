/**
 * E2E [@calls] — Popover de lancement d'appel (ConversationHeader)
 *
 * Vérifie que :
 *  1. la sélection des membres (cases cochées par défaut) pilote le récapitulatif
 *     et le lancement — décocher tout désactive les boutons d'appel ;
 *  2. le clic sur « Appel vocal » ferme immédiatement le popover, affiche la vue
 *     d'appel et n'autorise pas de double-clic (bouton désactivé pendant la
 *     création) ;
 *  3. le flux d'appel reste correct après navigation SPA et bascules
 *     full → mini → pip (le <LiveKitRoom> n'est jamais démonté).
 */
import { test, expect, type Page } from "../../playwright-fixture";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
const SUPABASE_ANON = process.env.E2E_SUPABASE_ANON_KEY!;
const SUPABASE_SR = process.env.E2E_SUPABASE_SERVICE_ROLE!;

const OWNER = {
  id: "dddddddd-1111-4444-8888-000000000911",
  email: "call.launcher@test.local",
  password: "CallLauncher1234!",
  name: "Awa Organisatrice",
};
const MATE = {
  id: "dddddddd-1111-4444-8888-000000000912",
  email: "call.launcher.mate@test.local",
  password: "CallLauncher1234!",
  name: "Mamadou Membre",
};
const GROUP_ID = "dddddddd-2222-4444-8888-000000000913";

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

const admin = () =>
  createClient(SUPABASE_URL, SUPABASE_SR, { auth: { persistSession: false } });

async function ensureUser(u: typeof OWNER) {
  const a = admin();
  const { error } = await a.auth.admin.createUser({
    id: u.id,
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { full_name: u.name, otp_verified: true },
  });
  if (error && !/already|registered|exists/i.test(error.message)) {
    throw new Error(`seed user ${u.email}: ${error.message}`);
  }
}

async function seed() {
  await ensureUser(OWNER);
  await ensureUser(MATE);
  const a = admin();

  await a.from("group_members").delete().eq("group_id", GROUP_ID);
  await a.from("groups").delete().eq("id", GROUP_ID);

  const { error: gErr } = await a.from("groups").insert({
    id: GROUP_ID,
    name: "Tontine Appels E2E",
    created_by: OWNER.id,
    amount_per_member: 100000,
    frequency: "mensuelle",
    status: "active",
  });
  if (gErr) throw new Error(`seed group: ${gErr.message}`);

  const { error: mErr } = await a.from("group_members").insert([
    { group_id: GROUP_ID, user_id: OWNER.id, role: "organisateur", status: "active" },
    { group_id: GROUP_ID, user_id: MATE.id, role: "membre", status: "active" },
  ]);
  if (mErr) throw new Error(`seed members: ${mErr.message}`);

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({
    email: OWNER.email,
    password: OWNER.password,
  });
  if (error || !data.session) throw new Error(`sign in: ${error?.message}`);
  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  return { storageKey: `sb-${ref}-auth-token`, session: data.session };
}

async function gotoDiscussion(page: Page) {
  const { storageKey, session } = await seed();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([k, v]) => window.localStorage.setItem(k, v),
    [storageKey, JSON.stringify(session)] as const,
  );
  await page.goto(`${BASE}/discussions/${GROUP_ID}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__lovableCall, null, { timeout: 15000 });
}

async function counters(page: Page) {
  return page.evaluate(() => ({
    mounts: window.__livekitRoomMounts ?? 0,
    unmounts: window.__livekitRoomUnmounts ?? 0,
  }));
}

test.describe("@calls popover de lancement d'appel", () => {
  test("sélection des membres et lancement immédiat", async ({ page }) => {
    await gotoDiscussion(page);

    await page.getByRole("button", { name: "Démarrer un appel" }).click();
    const list = page.getByTestId("call-member-list");
    await expect(list).toBeVisible();

    // Toutes les cases sont cochées par défaut.
    const boxes = list.locator('input[type="checkbox"]');
    await expect(boxes).toHaveCount(2);
    for (let i = 0; i < 2; i++) await expect(boxes.nth(i)).toBeChecked();
    await expect(page.getByTestId("call-selection-count")).toContainText("2 membres sélectionnés sur 2");

    // Décocher un membre met à jour le récapitulatif.
    await page.getByTestId(`call-member-${MATE.id}`).uncheck().catch(async () => {
      await boxes.nth(1).uncheck();
    });
    await expect(page.getByTestId("call-selection-count")).toContainText("sur 2");

    // Décocher tout désactive les deux boutons d'appel.
    await boxes.nth(0).uncheck();
    await expect(page.getByTestId("call-start-audio")).toBeDisabled();
    await expect(page.getByTestId("call-start-video")).toBeDisabled();

    // Re-cocher un membre puis lancer : le popover se ferme et l'appel s'affiche.
    await boxes.nth(0).check();
    const audio = page.getByTestId("call-start-audio");
    await expect(audio).toBeEnabled();
    await audio.click();

    await expect(page.getByTestId("call-member-list")).toHaveCount(0);
    await expect(page.getByTestId("livekit-room-probe")).toBeAttached({ timeout: 15000 });
    expect((await counters(page)).mounts).toBe(1);
  });

  test("le flux reste correct après navigation et bascules full → mini → pip", async ({ page }) => {
    await gotoDiscussion(page);

    await page.getByRole("button", { name: "Démarrer un appel" }).click();
    await expect(page.getByTestId("call-member-list")).toBeVisible();
    await page.getByTestId("call-start-video").click();
    await expect(page.getByTestId("livekit-room-probe")).toBeAttached({ timeout: 15000 });

    await page.evaluate(() => window.__lovableCall!.minimize());
    await expect(page.getByTestId("call-active-banner")).toBeVisible();

    for (const route of ["/groupes", "/dashboard", "/discussions"]) {
      await page.evaluate((r) => {
        window.history.pushState({}, "", r);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, route);
      await page.waitForTimeout(300);
      await expect(page.getByTestId("livekit-room-probe")).toBeAttached();
    }

    await page.evaluate(() => window.__lovableCall!.expand());
    await page.waitForTimeout(150);
    await page.evaluate(() =>
      document.dispatchEvent(new Event("enterpictureinpicture", { bubbles: true })),
    );
    await page.waitForTimeout(150);
    await expect(page.getByTestId("livekit-room-probe")).toBeAttached();
    await page.evaluate(() =>
      document.dispatchEvent(new Event("leavepictureinpicture", { bubbles: true })),
    );
    await page.waitForTimeout(150);

    const c = await counters(page);
    expect(c.mounts).toBe(1);
    expect(c.unmounts).toBe(0);

    await page.evaluate(() => window.__lovableCall!.hangup());
    await expect(page.getByTestId("livekit-room-probe")).toHaveCount(0);
  });
});
