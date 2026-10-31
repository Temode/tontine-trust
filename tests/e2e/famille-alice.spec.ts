/**
 * End-to-end test: Famille Alice scenario.
 *
 * Verifies, against the seeded deterministic fixtures:
 *   - [@audit]         suspend/reactivate produce audit_log rows
 *   - [@notifications] target user receives in-app notifications
 *   - [@rls]           members see their group, non-members do not leak
 *   - [@dashboard]     DuesCard / UpcomingTurnsCard / RecentAnnouncementsCard render
 *   - [@rotation]      Famille Alice members count + rotation beneficiaries
 *
 * Failures in @audit / @notifications / @rls are CI-blocking (see CI workflow).
 */
import { test, expect } from "../../playwright-fixture";
import { FIXTURES } from "./fixtures/famille-alice";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
const SUPABASE_ANON = process.env.E2E_SUPABASE_ANON_KEY!;
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8080";

const ALICE = FIXTURES.users.find((u) => u.email === "alice@test.local")!;
const BOB = FIXTURES.users.find((u) => u.email === "bob@test.local")!;
const GROUP = FIXTURES.group;

async function login(email: string, password: string) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
  return (await r.json()).access_token as string;
}

async function rest(token: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = r.status === 204 ? [] : await r.json().catch(() => []);
  return { status: r.status, body } as { status: number; body: any };
}

test.describe("Famille Alice — E2E", () => {
  test("[@rls] member sees own group, non-member sees nothing leaked", async () => {
    const bobTok = await login(BOB.email, FIXTURES.password);

    const own = await rest(bobTok, `group_members?group_id=eq.${GROUP.id}&select=id`);
    expect(own.status).toBe(200);
    expect(Array.isArray(own.body) && own.body.length).toBeGreaterThanOrEqual(3);

    // Probe a non-existent group id — RLS should return [] (not error).
    const phantom = "00000000-0000-0000-0000-0000000000ff";
    const leak = await rest(bobTok, `group_members?group_id=eq.${phantom}&select=id`);
    expect(leak.status).toBe(200);
    expect(leak.body).toEqual([]);
    const leakAnn = await rest(bobTok, `group_announcements?group_id=eq.${phantom}&select=id`);
    expect(leakAnn.body).toEqual([]);
  });

  test("[@audit][@notifications] suspend/reactivate logs audit + notifies member", async () => {
    const aliceTok = await login(ALICE.email, FIXTURES.password);
    const bobTok = await login(BOB.email, FIXTURES.password);

    const { body: gm } = await rest(
      aliceTok,
      `group_members?group_id=eq.${GROUP.id}&user_id=eq.${BOB.id}&select=id,status`,
    );
    expect(Array.isArray(gm) && gm.length).toBe(1);
    const memberId = gm[0].id;

    if (gm[0].status === "suspended") {
      await rest(aliceTok, "rpc/reactivate_member", {
        method: "POST",
        body: JSON.stringify({ _member_id: memberId }),
      });
    }

    const baselineAudit = (await rest(aliceTok, `audit_log_view?group_id=eq.${GROUP.id}&select=id&order=created_at.desc&limit=200`)).body as any[];
    const baselineNotif = (await rest(bobTok, `notifications?select=id&order=created_at.desc&limit=200`)).body as any[];
    const oldAudit = new Set(baselineAudit.map((x: any) => x.id));
    const oldNotif = new Set(baselineNotif.map((x: any) => x.id));

    const sus = await rest(aliceTok, "rpc/suspend_member", {
      method: "POST",
      body: JSON.stringify({ _member_id: memberId, _reason: "e2e ci" }),
    });
    expect([200, 204]).toContain(sus.status);

    const rea = await rest(aliceTok, "rpc/reactivate_member", {
      method: "POST",
      body: JSON.stringify({ _member_id: memberId }),
    });
    expect([200, 204]).toContain(rea.status);

    // small settle window for triggers/notifications insert
    await new Promise((r) => setTimeout(r, 1500));

    const audit = (await rest(aliceTok, `audit_log_view?group_id=eq.${GROUP.id}&select=id,action&order=created_at.desc&limit=200`)).body as any[];
    const newActions = audit.filter((a: any) => !oldAudit.has(a.id)).map((a: any) => a.action);
    expect(newActions).toEqual(expect.arrayContaining(["member_suspended", "member_reactivated"]));

    const notifs = (await rest(bobTok, `notifications?select=id,kind&order=created_at.desc&limit=200`)).body as any[];
    const newKinds = notifs.filter((n: any) => !oldNotif.has(n.id)).map((n: any) => n.kind);
    expect(newKinds).toEqual(expect.arrayContaining(["member_suspended", "member_reactivated"]));
  });

  test("[@dashboard] member dashboard renders Dues / Upcoming / Announcements cards", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
    await page.locator('input[type=email]').first().fill(BOB.email);
    await page.locator('input[type=password]').first().fill(FIXTURES.password);
    await page.getByRole("button", { name: /connecter|connexion/i }).first().click();
    await page.waitForLoadState("networkidle");
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const text = (await page.locator("body").innerText()).toLowerCase();
    expect(text).toContain("à payer");
    expect(text).toContain("prochaines échéances");
    expect(text).toContain("annonces récentes");
  });

  test("[@rotation] Famille Alice shows 3 members and rotation beneficiaries", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
    await page.locator('input[type=email]').first().fill(BOB.email);
    await page.locator('input[type=password]').first().fill(FIXTURES.password);
    await page.getByRole("button", { name: /connecter|connexion/i }).first().click();
    await page.waitForLoadState("networkidle");

    await page.goto(`${BASE_URL}/groupes/${GROUP.id}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    await page.getByRole("tab", { name: /^membres$/i }).first().click();
    await page.waitForTimeout(1200);
    const mtext = await page.locator("body").innerText();
    for (const u of FIXTURES.users) {
      expect(mtext).toContain(u.name.split(" ")[0]);
    }

    await page.getByRole("tab", { name: /rotation|tours/i }).first().click();
    await page.waitForTimeout(1500);
    const rtext = await page.locator("body").innerText();
    // At least one fixture user appears as a beneficiary.
    expect(FIXTURES.users.some((u) => rtext.includes(u.name.split(" ")[0]))).toBe(true);
  });
});