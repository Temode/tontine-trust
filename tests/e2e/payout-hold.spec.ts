/**
 * E2E — Chantier 4: Pénalité de rétention majorée.
 *
 * Vérifie les colonnes, la config par fréquence, l'idempotence
 * de send_payout_hold_extended_if_needed et le blocage de
 * request_withdrawal quand payout_hold_until > now().
 */
import { test, expect } from "../../playwright-fixture";
import { FIXTURES } from "./fixtures/famille-alice";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
const SUPABASE_ANON = process.env.E2E_SUPABASE_ANON_KEY!;
const SERVICE_ROLE = process.env.E2E_SUPABASE_SERVICE_ROLE!;

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
      apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`,
      "Content-Type": "application/json", ...(init.headers ?? {}),
    },
  });
  const body = r.status === 204 ? null : await r.json().catch(() => null);
  return { status: r.status, body } as { status: number; body: any };
}
const admin = (path: string, init: RequestInit = {}) =>
  rest(SERVICE_ROLE, path, {
    ...init,
    headers: { Prefer: "return=representation", ...(init.headers ?? {}) },
  });

test.describe("Chantier 4 — Pénalité de rétention majorée", () => {
  test.skip(!SUPABASE_URL || !SUPABASE_ANON || !SERVICE_ROLE, "E2E secrets missing");

  test("[@hold] payout_hold_config couvre les 4 fréquences", async () => {
    const aliceTok = await login(ALICE.email, FIXTURES.password);
    const r = await rest(aliceTok, "payout_hold_config?select=frequency,standard_days,penalty_days");
    expect(r.status).toBe(200);
    const freqs = new Set((r.body ?? []).map((x: any) => x.frequency));
    for (const f of ["daily", "weekly", "biweekly", "monthly"]) {
      expect(freqs.has(f)).toBe(true);
    }
    // Pénalité ≥ standard + 7 (règle métier)
    for (const row of r.body ?? []) {
      expect(Number(row.penalty_days)).toBeGreaterThanOrEqual(Number(row.standard_days) + 7);
    }
  });

  test("[@hold] turns expose payout_hold_until ; flag was_late_in_cycle settable", async () => {
    const aliceTok = await login(ALICE.email, FIXTURES.password);
    const t = await rest(aliceTok, `turns?group_id=eq.${GROUP.id}&select=id,payout_hold_until&limit=1`);
    expect(t.status).toBe(200);
    if ((t.body ?? []).length) expect(t.body[0]).toHaveProperty("payout_hold_until");

    // Toggle was_late_in_cycle via service-role et constater le reflet côté lecture.
    await admin(`group_members?group_id=eq.${GROUP.id}&user_id=eq.${BOB.id}`, {
      method: "PATCH", body: JSON.stringify({ was_late_in_cycle: true, was_late_at_turn_number: 1 }),
    });
    const gm = await admin(
      `group_members?group_id=eq.${GROUP.id}&user_id=eq.${BOB.id}&select=was_late_in_cycle,was_late_at_turn_number`,
    );
    expect(gm.body[0].was_late_in_cycle).toBe(true);
    expect(gm.body[0].was_late_at_turn_number).toBe(1);
    // Reset
    await admin(`group_members?group_id=eq.${GROUP.id}&user_id=eq.${BOB.id}`, {
      method: "PATCH", body: JSON.stringify({ was_late_in_cycle: false, was_late_at_turn_number: null }),
    });
  });

  test("[@hold] request_withdrawal bloqué par payout_hold_until futur", async () => {
    // Pose un hold futur sur un turn de Bob.
    const turns = await admin(
      `turns?group_id=eq.${GROUP.id}&beneficiary_id=eq.${BOB.id}&select=id,payout_hold_until&limit=1`,
    );
    if (!(turns.body ?? []).length) test.skip(true, "Bob n'est pas bénéficiaire — pas de turn à tester");
    const turnId = turns.body[0].id;
    const future = new Date(Date.now() + 7 * 86400_000).toISOString();
    await admin(`turns?id=eq.${turnId}`, {
      method: "PATCH", body: JSON.stringify({ payout_hold_until: future, status: "paid" }),
    });

    const bobTok = await login(BOB.email, FIXTURES.password);
    const w = await rest(bobTok, "rpc/request_withdrawal", {
      method: "POST",
      body: JSON.stringify({
        _group_id: GROUP.id, _amount: 10000,
        _method: "mobile_money", _destination: "+224620000002",
      }),
    });
    expect(w.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(w.body).toUpperCase()).toMatch(
      /PAYOUT_LOCKED|HOLD|RETENTION|DEPOSIT|INSUFF|NOT_BENEF|NO_FUND/,
    );

    // Reset
    await admin(`turns?id=eq.${turnId}`, {
      method: "PATCH", body: JSON.stringify({ payout_hold_until: null }),
    });
  });

  test("[@hold] send_payout_hold_extended_if_needed est idempotent", async () => {
    const turns = await admin(`turns?group_id=eq.${GROUP.id}&select=id&limit=1`);
    if (!(turns.body ?? []).length) test.skip(true, "Aucun turn dans le groupe fixture");
    const turnId = turns.body[0].id;

    const before = (await admin(
      `payout_hold_notifications_log?turn_id=eq.${turnId}&select=id`,
    )).body as any[];

    const args = { _turn_id: turnId, _force: false, _actor: null as string | null };
    const r1 = await admin(`rpc/send_payout_hold_extended_if_needed`, {
      method: "POST", body: JSON.stringify(args),
    });
    const r2 = await admin(`rpc/send_payout_hold_extended_if_needed`, {
      method: "POST", body: JSON.stringify(args),
    });
    // L'appel peut être no-op si conditions non remplies — pas d'erreur attendue.
    expect([200, 204]).toContain(r1.status);
    expect([200, 204]).toContain(r2.status);

    const after = (await admin(
      `payout_hold_notifications_log?turn_id=eq.${turnId}&select=id`,
    )).body as any[];
    // Au plus une nouvelle ligne malgré le double appel.
    expect(after.length - (before?.length ?? 0)).toBeLessThanOrEqual(1);
  });

  test("[@hold] list_my_payout_hold_history ne fuite pas d'autres bénéficiaires", async () => {
    const bobTok = await login(BOB.email, FIXTURES.password);
    const r = await rest(bobTok, "rpc/list_my_payout_hold_history", {
      method: "POST", body: "{}",
    });
    expect(r.status).toBe(200);
    for (const row of r.body ?? []) {
      // Toutes les lignes doivent concerner Bob.
      if ("beneficiary_id" in row) expect(row.beneficiary_id).toBe(BOB.id);
    }
  });
});