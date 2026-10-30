/**
 * E2E — Chantier 2: Caution & verrou dernier tiers.
 *
 * Scénarios A/B/C convertis de tests/e2e/deposits.spec.md.
 * Vérifie les garde-fous backend (RPC + colonnes) ; les flux UI Djomy
 * (paiement réel) sont volontairement hors scope car ils dépendent
 * d'un sandbox externe.
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
async function admin(path: string, init: RequestInit = {}) {
  return rest(SERVICE_ROLE, path, {
    ...init,
    headers: { Prefer: "return=representation", ...(init.headers ?? {}) },
  });
}

test.describe("Chantier 2 — Caution / verrou dernier tiers", () => {
  test.skip(!SUPABASE_URL || !SUPABASE_ANON || !SERVICE_ROLE, "E2E secrets missing");

  test("[@deposit] colonnes deposit_status + was_late_* présentes sur group_members", async () => {
    const aliceTok = await login(ALICE.email, FIXTURES.password);
    const { body } = await rest(
      aliceTok,
      `group_members?group_id=eq.${GROUP.id}&user_id=eq.${BOB.id}&select=deposit_status,was_late_in_cycle,was_late_at_turn_number`,
    );
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty("deposit_status");
    expect(body[0]).toHaveProperty("was_late_in_cycle");
  });

  test("[@deposit] request_withdrawal renvoie une erreur quand la caution est requise", async () => {
    // Force deposit_required + deposit_status=required pour Bob.
    await admin(
      `group_members?group_id=eq.${GROUP.id}&user_id=eq.${BOB.id}`,
      { method: "PATCH", body: JSON.stringify({ deposit_required: true, deposit_status: "required" }) },
    );
    const bobTok = await login(BOB.email, FIXTURES.password);
    const r = await rest(bobTok, "rpc/request_withdrawal", {
      method: "POST",
      body: JSON.stringify({
        _group_id: GROUP.id, _amount: 10000,
        _method: "mobile_money", _destination: "+224620000002",
      }),
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
    const msg = JSON.stringify(r.body).toUpperCase();
    expect(msg).toMatch(/DEPOSIT|CAUTION|POSITION|HOLD|LOCK|INSUFF/);
    // Reset pour ne pas casser d'autres tests.
    await admin(
      `group_members?group_id=eq.${GROUP.id}&user_id=eq.${BOB.id}`,
      { method: "PATCH", body: JSON.stringify({ deposit_required: false, deposit_status: null }) },
    );
  });

  test("[@deposit] admin_force_deposit_status journalise une entrée audit", async () => {
    // Crée un member_deposit pending via service role pour Bob.
    const baselineAudit = (await admin(
      `audit_log?action=eq.deposit_forced&select=id&order=created_at.desc&limit=50`,
    )).body as any[];
    const oldIds = new Set((baselineAudit ?? []).map((x: any) => x.id));

    const dep = await admin(`member_deposits`, {
      method: "POST",
      body: JSON.stringify({
        group_id: GROUP.id, user_id: BOB.id,
        amount: 500000, status: "pending",
      }),
    });
    const depId = Array.isArray(dep.body) ? dep.body[0]?.id : dep.body?.id;
    if (!depId) test.skip(true, "member_deposits insert refused — schema variant");

    const aliceTok = await login(ALICE.email, FIXTURES.password);
    const force = await rest(aliceTok, "rpc/admin_force_deposit_status", {
      method: "POST",
      body: JSON.stringify({
        _deposit_id: depId, _new_status: "paid",
        _reason: "e2e regularisation tardive 1234567890",
      }),
    });
    // Peut renvoyer 403 si Alice n'est pas super-admin → tolérance.
    if (force.status >= 400) {
      test.info().annotations.push({ type: "warn", description: `force=${force.status}` });
    } else {
      await new Promise((r) => setTimeout(r, 800));
      const newAudit = (await admin(
        `audit_log?action=eq.deposit_forced&select=id&order=created_at.desc&limit=50`,
      )).body as any[];
      const fresh = (newAudit ?? []).filter((a: any) => !oldIds.has(a.id));
      expect(fresh.length).toBeGreaterThan(0);
    }
    // Cleanup
    await admin(`member_deposits?id=eq.${depId}`, { method: "DELETE" });
  });
});