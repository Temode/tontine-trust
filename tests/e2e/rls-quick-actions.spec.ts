/**
 * End-to-end test: RLS / Quick Actions invitations & validation.
 *
 * Verifies, against the seeded RLS_FIXTURES:
 *   - [@rls] invitation codes: valid / expired / exhausted / revoked / malformed
 *   - [@rls] organizer-only visibility on invitations
 *   - [@rls] validation server-side on contribution amount and frequency
 *
 * Failures here are CI-blocking.
 */
import { test, expect } from "../../playwright-fixture";
import { RLS_FIXTURES } from "./fixtures/rls-quick-actions";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
const SUPABASE_ANON = process.env.E2E_SUPABASE_ANON_KEY!;

const ORG = RLS_FIXTURES.users[0];
const OUTSIDER = RLS_FIXTURES.users[2];
const GROUP = RLS_FIXTURES.group;
const INV = Object.fromEntries(
  RLS_FIXTURES.invitations.map((i) => [i.label, i]),
) as Record<"valid" | "expired" | "exhausted" | "revoked", (typeof RLS_FIXTURES.invitations)[number]>;

async function login(email: string, password: string) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
  return (await r.json()).access_token as string;
}

async function rpc(token: string, name: string, body: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  return { status: r.status, body: parsed as { message?: string } | null, raw: text };
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

test.describe("Quick Actions — RLS & validation", () => {
  test("[@rls] expired invitation is rejected", async () => {
    const tok = await login(OUTSIDER.email, RLS_FIXTURES.password);
    const res = await rpc(tok, "join_group_with_code", { _code: INV.expired.code });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body ?? res.raw)).toMatch(/INVITATION_EXPIRED/);
  });

  test("[@rls] exhausted invitation is rejected", async () => {
    const tok = await login(OUTSIDER.email, RLS_FIXTURES.password);
    const res = await rpc(tok, "join_group_with_code", { _code: INV.exhausted.code });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body ?? res.raw)).toMatch(/INVITATION_EXHAUSTED/);
  });

  test("[@rls] revoked invitation is rejected", async () => {
    const tok = await login(OUTSIDER.email, RLS_FIXTURES.password);
    const res = await rpc(tok, "join_group_with_code", { _code: INV.revoked.code });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body ?? res.raw)).toMatch(/INVITATION_INACTIVE|INVITATION_REVOKED/);
  });

  test("[@rls] unknown / malformed invitation code is rejected", async () => {
    const tok = await login(OUTSIDER.email, RLS_FIXTURES.password);
    const res = await rpc(tok, "join_group_with_code", { _code: "ZZZZ-9999" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body ?? res.raw)).toMatch(/INVITATION_NOT_FOUND/);
  });

  test("[@rls] preview is available for a valid code only", async () => {
    const tok = await login(OUTSIDER.email, RLS_FIXTURES.password);
    const ok = await rpc(tok, "preview_group_by_code", { _code: INV.valid.code });
    expect(ok.status).toBe(200);
    const bad = await rpc(tok, "preview_group_by_code", { _code: INV.expired.code });
    expect(bad.status).toBeGreaterThanOrEqual(400);
  });

  test("[@rls] only the organizer can list invitations of their group", async () => {
    const outTok = await login(OUTSIDER.email, RLS_FIXTURES.password);
    const leak = await rest(
      outTok,
      `invitations?group_id=eq.${GROUP.id}&select=id,code`,
    );
    expect(leak.status).toBe(200);
    expect(leak.body).toEqual([]);

    const orgTok = await login(ORG.email, RLS_FIXTURES.password);
    const own = await rest(
      orgTok,
      `invitations?group_id=eq.${GROUP.id}&select=id,code`,
    );
    expect(own.status).toBe(200);
    expect(Array.isArray(own.body) && own.body.length).toBeGreaterThanOrEqual(4);
  });

  test("[@rls] insert with an unknown frequency is rejected by the enum", async () => {
    const orgTok = await login(ORG.email, RLS_FIXTURES.password);
    const r = await rest(orgTok, "groups", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        name: "rls-bad-freq",
        contribution_amount: 10_000,
        frequency: "yearly",
        created_by: ORG.id,
      }),
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  test("[@rls] insert below the minimum contribution amount is rejected", async () => {
    const orgTok = await login(ORG.email, RLS_FIXTURES.password);
    const r = await rest(orgTok, "groups", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        name: "rls-bad-amount",
        contribution_amount: 500,
        frequency: "mensuelle",
        created_by: ORG.id,
      }),
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});