/**
 * Deterministic E2E fixtures for the RLS / Quick Actions scenario.
 *
 * Seeds three users + one group + four invitations in known states
 * (valid, expired, exhausted, revoked) so that the rls-quick-actions
 * spec can assert RPC behaviour without flakiness.
 *
 * Idempotent: every run upserts the same UUIDs / rows.
 *
 * Required env:
 *   - E2E_SUPABASE_URL
 *   - E2E_SUPABASE_SERVICE_ROLE
 *
 * Usage:
 *   bun run tests/e2e/fixtures/rls-quick-actions.ts
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.E2E_SUPABASE_URL;
const SR = process.env.E2E_SUPABASE_SERVICE_ROLE;
if (!URL || !SR) {
  console.error("Missing E2E_SUPABASE_URL or E2E_SUPABASE_SERVICE_ROLE");
  process.exit(2);
}

const admin = createClient(URL, SR, { auth: { persistSession: false } });

export const RLS_FIXTURES = {
  password: "Test1234!",
  users: [
    {
      id: "11111111-aaaa-4aaa-aaaa-000000000001",
      email: "rls-organizer@rls.test",
      name: "RLS Organisateur",
      phone: "+224620900001",
    },
    {
      id: "11111111-aaaa-4aaa-aaaa-000000000002",
      email: "rls-member@rls.test",
      name: "RLS Membre",
      phone: "+224620900002",
    },
    {
      id: "11111111-aaaa-4aaa-aaaa-000000000003",
      email: "rls-outsider@rls.test",
      name: "RLS Étranger",
      phone: "+224620900003",
    },
  ],
  group: {
    id: "22222222-bbbb-4bbb-bbbb-000000000001",
    name: "Tontine RLS Test",
    contribution_amount: 10_000,
    frequency: "mensuelle" as const,
    max_members: 5,
  },
  invitations: [
    {
      id: "33333333-cccc-4ccc-cccc-000000000001",
      code: "TD-VAL2-D003",
      label: "valid",
      status: "pending" as const,
      max_uses: 5,
      uses_count: 0,
      expires_at: () => new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: "33333333-cccc-4ccc-cccc-000000000002",
      code: "TD-EXP2-R003",
      label: "expired",
      status: "pending" as const,
      max_uses: 5,
      uses_count: 0,
      expires_at: () => new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
    {
      id: "33333333-cccc-4ccc-cccc-000000000003",
      code: "TD-EXH2-U003",
      label: "exhausted",
      status: "pending" as const,
      max_uses: 1,
      uses_count: 1,
      expires_at: () => null as string | null,
    },
    {
      id: "33333333-cccc-4ccc-cccc-000000000004",
      code: "TD-RVK2-Z003",
      label: "revoked",
      status: "revoked" as const,
      max_uses: 5,
      uses_count: 0,
      expires_at: () => null as string | null,
    },
  ],
} as const;

async function ensureUser(u: typeof RLS_FIXTURES.users[number]) {
  const { error } = await admin.auth.admin.createUser({
    id: u.id,
    email: u.email,
    password: RLS_FIXTURES.password,
    email_confirm: true,
    user_metadata: { full_name: u.name },
  });
  if (error && !/already (registered|exists)|duplicate/i.test(error.message)) {
    throw new Error(`createUser(${u.email}): ${error.message}`);
  }
  const { error: pErr } = await admin
    .from("profiles")
    .upsert({ id: u.id, full_name: u.name, phone_number: u.phone }, { onConflict: "id" });
  if (pErr) throw new Error(`profile upsert(${u.email}): ${pErr.message}`);
}

async function ensureGroup() {
  const g = RLS_FIXTURES.group;
  const organizer = RLS_FIXTURES.users[0];
  const member = RLS_FIXTURES.users[1];

  const { error: gErr } = await admin.from("groups").upsert(
    {
      id: g.id,
      name: g.name,
      created_by: organizer.id,
      contribution_amount: g.contribution_amount,
      frequency: g.frequency,
      max_members: g.max_members,
      status: "active",
    },
    { onConflict: "id" },
  );
  if (gErr) throw new Error(`group upsert: ${gErr.message}`);

  const { error: mErr } = await admin.from("group_members").upsert(
    [
      { group_id: g.id, user_id: organizer.id, role: "organizer", status: "active", position: 1 },
      { group_id: g.id, user_id: member.id, role: "participant", status: "active", position: 2 },
    ],
    { onConflict: "group_id,user_id" },
  );
  if (mErr) throw new Error(`group_members upsert: ${mErr.message}`);
}

async function ensureInvitations() {
  const g = RLS_FIXTURES.group;
  const organizer = RLS_FIXTURES.users[0];

  for (const inv of RLS_FIXTURES.invitations) {
    const { error } = await admin.from("invitations").upsert(
      {
        id: inv.id,
        group_id: g.id,
        code: inv.code,
        created_by: organizer.id,
        max_uses: inv.max_uses,
        uses_count: inv.uses_count,
        status: inv.status,
        expires_at: inv.expires_at(),
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(`invitation upsert(${inv.label}): ${error.message}`);
  }
}

export async function seedRlsFixtures() {
  for (const u of RLS_FIXTURES.users) await ensureUser(u);
  await ensureGroup();
  await ensureInvitations();
  console.log("RLS quick-actions fixtures applied:", {
    users: RLS_FIXTURES.users.map((u) => u.email),
    group: RLS_FIXTURES.group.name,
    invitations: RLS_FIXTURES.invitations.map((i) => `${i.label}=${i.code}`),
  });
}

const isDirect = import.meta.url === `file://${process.argv[1]}`;
if (isDirect) {
  seedRlsFixtures().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}