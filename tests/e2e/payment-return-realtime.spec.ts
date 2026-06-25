/**
 * E2E: retour après paiement Djomy
 *   - Vérifie que la route /paiement/retour est servie (SPA route correctement câblée).
 *   - Simule la réception du webhook Djomy (UPDATE de payments.status → 'succeeded')
 *     côté service-role et vérifie que DEUX membres abonnés en Realtime reçoivent
 *     instantanément l'évènement, sans aucun rechargement de page.
 *
 * Reproduit le scénario "Kankou est revenue avec la flèche retour" : sans cette
 * synchro Realtime + réconciliation forcée au montage, l'UI restait sur "à payer"
 * alors que Djomy avait bien encaissé.
 */
import { test, expect } from "../../playwright-fixture";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { FIXTURES } from "./fixtures/famille-alice";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
const SUPABASE_ANON = process.env.E2E_SUPABASE_ANON_KEY!;
const SERVICE_ROLE = process.env.E2E_SUPABASE_SERVICE_ROLE!;
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8080";

const GROUP = FIXTURES.group;
const BOB = FIXTURES.users.find((u) => u.email === "bob@test.local")!;
const HADJA = FIXTURES.users.find((u) => u.email === "hadja@test.local")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function loginToken(email: string) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: FIXTURES.password }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
  return (await r.json()).access_token as string;
}

async function ensureTurnContributionAndPayment(userId: string) {
  // 1. cycle (1 par groupe)
  let { data: cyc } = await admin
    .from("cycles")
    .select("id")
    .eq("group_id", GROUP.id)
    .eq("cycle_number", 1)
    .maybeSingle();
  if (!cyc) {
    const ins = await admin
      .from("cycles")
      .insert({ group_id: GROUP.id, cycle_number: 1 })
      .select("id")
      .single();
    cyc = ins.data!;
  }

  // 2. turn (déterministe : turn_number stable par user via hash léger sur uuid)
  const turnNumber = (parseInt(userId.slice(0, 8), 16) % 90) + 10;
  let { data: turn } = await admin
    .from("turns")
    .select("id")
    .eq("cycle_id", cyc.id)
    .eq("turn_number", turnNumber)
    .maybeSingle();
  if (!turn) {
    const ins = await admin
      .from("turns")
      .insert({
        cycle_id: cyc.id,
        group_id: GROUP.id,
        beneficiary_user_id: userId,
        turn_number: turnNumber,
        due_date: new Date().toISOString().slice(0, 10),
        payout_amount: GROUP.contribution_amount,
      })
      .select("id")
      .single();
    turn = ins.data!;
  }

  // 3. contribution
  let { data: contrib } = await admin
    .from("contributions")
    .select("id")
    .eq("turn_id", turn.id)
    .eq("payer_user_id", userId)
    .maybeSingle();
  if (!contrib) {
    const ins = await admin
      .from("contributions")
      .insert({
        turn_id: turn.id,
        group_id: GROUP.id,
        payer_user_id: userId,
        amount: GROUP.contribution_amount,
        status: "pending",
      })
      .select("id")
      .single();
    contrib = ins.data!;
  }

  // 4. payment 'pending' frais à chaque exécution (provider_ref unique)
  const ref = `e2e-${userId.slice(0, 8)}-${Date.now()}`;
  const { data: pay, error: payErr } = await admin
    .from("payments")
    .insert({
      contribution_id: contrib.id,
      group_id: GROUP.id,
      user_id: userId,
      amount: GROUP.contribution_amount,
      provider: "djomy",
      provider_ref: ref,
      status: "pending",
    })
    .select("id")
    .single();
  if (payErr) throw new Error(`payment insert: ${payErr.message}`);
  return pay!.id as string;
}

function waitForSucceeded(token: string, paymentId: string, timeoutMs = 8000) {
  return new Promise<{ status: string; receivedAt: number }>((resolve, reject) => {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } },
    });
    // Forcer l'auth Realtime avec le token utilisateur (RLS).
    client.realtime.setAuth(token);

    let channel: RealtimeChannel | null = null;
    const timer = setTimeout(() => {
      void client.removeChannel(channel!);
      reject(new Error(`Pas d'évènement Realtime 'succeeded' pour ${paymentId} en ${timeoutMs}ms`));
    }, timeoutMs);

    channel = client
      .channel(`e2e-pay-${paymentId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "payments", filter: `id=eq.${paymentId}` },
        (payload) => {
          const next = (payload.new as { status?: string }).status;
          if (next === "succeeded") {
            clearTimeout(timer);
            void client.removeChannel(channel!);
            resolve({ status: next, receivedAt: Date.now() });
          }
        },
      )
      .subscribe();
  });
}

test.describe("Paiement retour — Realtime + route", () => {
  test("[@payments] /paiement/retour est routée (SPA fallback OK)", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/paiement/retour`, { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(400);
    // Le composant PaymentReturn rend toujours le titre, même sans paymentId.
    await expect(page.getByRole("heading", { name: /Suivi du paiement/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test("[@payments] deux membres voient 'succeeded' instantanément via Realtime", async () => {
    const [bobTok, hadjaTok] = await Promise.all([loginToken(BOB.email), loginToken(HADJA.email)]);

    const [bobPay, hadjaPay] = await Promise.all([
      ensureTurnContributionAndPayment(BOB.id),
      ensureTurnContributionAndPayment(HADJA.id),
    ]);

    // Les deux clients s'abonnent AVANT que le webhook ne flippe le statut.
    const bobWait = waitForSucceeded(bobTok, bobPay);
    const hadjaWait = waitForSucceeded(hadjaTok, hadjaPay);

    // Laisser ~500ms aux subscriptions de se setup.
    await new Promise((r) => setTimeout(r, 500));

    const flippedAt = Date.now();
    const updates = await Promise.all([
      admin.from("payments").update({ status: "succeeded", settled_at: new Date().toISOString() }).eq("id", bobPay),
      admin.from("payments").update({ status: "succeeded", settled_at: new Date().toISOString() }).eq("id", hadjaPay),
    ]);
    for (const u of updates) expect(u.error).toBeNull();

    const [bobEvent, hadjaEvent] = await Promise.all([bobWait, hadjaWait]);
    expect(bobEvent.status).toBe("succeeded");
    expect(hadjaEvent.status).toBe("succeeded");
    // Pas de rechargement : l'évènement doit arriver en < 5s après le UPDATE.
    expect(bobEvent.receivedAt - flippedAt).toBeLessThan(5000);
    expect(hadjaEvent.receivedAt - flippedAt).toBeLessThan(5000);
  });
});