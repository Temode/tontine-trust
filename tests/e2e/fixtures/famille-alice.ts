/**
 * Deterministic E2E fixtures for the "Famille Alice" scenario.
 *
 * Idempotent: every run upserts the same UUIDs / rows so the
 * Playwright spec can rely on stable identifiers.
 *
 * Required env (CI provides them via repo secrets):
 *   - E2E_SUPABASE_URL            (e.g. https://xxx.supabase.co)
 *   - E2E_SUPABASE_SERVICE_ROLE   (service-role key, never commit)
 *
 * Usage:
 *   npx tsx tests/e2e/fixtures/famille-alice.ts
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.E2E_SUPABASE_URL;
const SR = process.env.E2E_SUPABASE_SERVICE_ROLE;
if (!URL || !SR) {
  console.error("Missing E2E_SUPABASE_URL or E2E_SUPABASE_SERVICE_ROLE");
  process.exit(2);
}

const admin = createClient(URL, SR, { auth: { persistSession: false } });

export const FIXTURES = {
  password: "Test1234!",
  users: [
    { id: "834a3f02-02fe-4e48-904f-bcb5e99700da", email: "alice@test.local",  name: "Alice Organisatrice", phone: "+224620000001" },
    { id: "908dd7d3-014b-45f2-934c-22c1e9de58a9", email: "bob@test.local",    name: "Bob Participant",     phone: "+224620000002" },
    { id: "899d78fd-bc73-4c84-a873-7b7a84c35e27", email: "hadja@test.local",  name: "Hadja kankou touré",  phone: "+224620000003" },
  ],
  group: {
    id: "ddc614a3-8f6d-4ad1-a930-6e427e410311",
    name: "Famille Alice",
    contribution_amount: 500_000,
    frequency: "monthly" as const,
    ownerEmail: "alice@test.local",
    memberEmails: ["bob@test.local", "hadja@test.local"],
  },
  announcement: {
    id: "11111111-2222-3333-4444-555555550001",
    title: "Reunion",
    body:
      "Avant de lancer la tontine, nous prions tous les membres d'être présent demain à 9H00 pour une reunion d'éclaircissement et d'établissement des règles qui regirons notre groupe de tontine",
  },
} as const;

async function ensureUser(u: typeof FIXTURES.users[number]) {
  // Try create with deterministic id; if exists, fetch and continue.
  const { error } = await admin.auth.admin.createUser({
    id: u.id,
    email: u.email,
    password: FIXTURES.password,
    email_confirm: true,
    user_metadata: { full_name: u.name },
  });
  if (error && !/already (registered|exists)|duplicate/i.test(error.message)) {
    throw new Error(`createUser(${u.email}): ${error.message}`);
  }
  // Upsert profile (idempotent).
  const { error: pErr } = await admin
    .from("profiles")
    .upsert({ id: u.id, full_name: u.name, phone_number: u.phone }, { onConflict: "id" });
  if (pErr) throw new Error(`profile upsert(${u.email}): ${pErr.message}`);
}

async function ensureGroupAndMembers() {
  const g = FIXTURES.group;
  const owner = FIXTURES.users.find((u) => u.email === g.ownerEmail)!;
  const { error: gErr } = await admin.from("groups").upsert(
    {
      id: g.id,
      name: g.name,
      created_by: owner.id,
      contribution_amount: g.contribution_amount,
      frequency: g.frequency,
      status: "active",
    },
    { onConflict: "id" },
  );
  if (gErr) throw new Error(`group upsert: ${gErr.message}`);

  // Members: owner at position 1, others 2/3.
  const memberRows = [
    { group_id: g.id, user_id: owner.id, role: "organizer", status: "active", position: 1 },
    ...g.memberEmails.map((email, idx) => {
      const u = FIXTURES.users.find((x) => x.email === email)!;
      return { group_id: g.id, user_id: u.id, role: "participant", status: "active", position: idx + 2 };
    }),
  ];
  const { error: mErr } = await admin
    .from("group_members")
    .upsert(memberRows, { onConflict: "group_id,user_id" });
  if (mErr) throw new Error(`group_members upsert: ${mErr.message}`);

  // One stable announcement so RecentAnnouncementsCard always has content.
  const a = FIXTURES.announcement;
  const { error: aErr } = await admin.from("group_announcements").upsert(
    { id: a.id, group_id: g.id, author_user_id: owner.id, title: a.title, body: a.body },
    { onConflict: "id" },
  );
  if (aErr) throw new Error(`announcement upsert: ${aErr.message}`);
}

export async function seed() {
  for (const u of FIXTURES.users) await ensureUser(u);
  await ensureGroupAndMembers();
  console.log("E2E fixtures applied:", {
    users: FIXTURES.users.map((u) => u.email),
    group: FIXTURES.group.name,
  });
}

// Run when invoked directly (tsx / node --import).
const isDirect = import.meta.url === `file://${process.argv[1]}`;
if (isDirect) {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}