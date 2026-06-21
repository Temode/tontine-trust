/**
 * send-tontine-reminders — cron quotidien.
 *
 * Envoie deux types de SMS via Nimba :
 *   1. J-2 avant le prochain tour (status='upcoming', due_date = today+2) → bénéficiaire.
 *   2. J-1 avant la cotisation due (turn 'collecting' avec contributions 'pending',
 *      due_date = today+1) → tous les membres restant à payer.
 *
 * Respecte `notification_preferences (channel='sms', enabled=true)` ; défaut ON.
 * Ignore les utilisateurs sans numéro normalisable.
 * Journalise chaque tentative dans `sms_logs`.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { fmtSms, normalizeGNPhone, sendMessage } from "../_shared/nimbasms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function addDaysISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type PrefMap = Map<string, boolean>; // key = `${user_id}:${kind}`

async function loadSmsPrefs(
  admin: ReturnType<typeof createClient>,
  userIds: string[],
  kinds: string[],
): Promise<PrefMap> {
  const out: PrefMap = new Map();
  if (userIds.length === 0) return out;
  const { data } = await admin
    .from("notification_preferences")
    .select("user_id, notif_type, enabled")
    .in("user_id", userIds)
    .in("notif_type", kinds)
    .eq("channel", "sms");
  for (const row of (data ?? []) as Array<{ user_id: string; notif_type: string; enabled: boolean }>) {
    out.set(`${row.user_id}:${row.notif_type}`, row.enabled);
  }
  return out;
}

function optedIn(prefs: PrefMap, userId: string, kind: string): boolean {
  const v = prefs.get(`${userId}:${kind}`);
  return v === undefined ? true : v; // défaut ON
}

async function loadPhones(
  admin: ReturnType<typeof createClient>,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (userIds.length === 0) return out;
  const { data } = await admin
    .from("profiles")
    .select("id, phone_number")
    .in("id", userIds);
  for (const row of (data ?? []) as Array<{ id: string; phone_number: string | null }>) {
    out.set(row.id, normalizeGNPhone(row.phone_number));
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, key);

  const target_turn_date = addDaysISO(2); // J-2 prochain tour
  const target_due_date = addDaysISO(1); // J-1 cotisation due

  let sentTurn = 0;
  let sentContribution = 0;
  let skipped = 0;

  // ── 1. Prochain tour J-2 ────────────────────────────────────────────────
  const { data: upcomingTurns, error: tErr } = await admin
    .from("turns")
    .select("id, group_id, turn_number, due_date, payout_amount, beneficiary_user_id, groups(name)")
    .eq("status", "upcoming")
    .eq("due_date", target_turn_date);
  if (tErr) console.error("[reminders] turns fetch:", tErr);

  const turnUsers = (upcomingTurns ?? []).map((t: any) => t.beneficiary_user_id);
  const turnPhones = await loadPhones(admin, turnUsers);
  const turnPrefs = await loadSmsPrefs(admin, turnUsers, ["turn_started"]);

  for (const t of (upcomingTurns ?? []) as any[]) {
    const phone = turnPhones.get(t.beneficiary_user_id);
    if (!phone) { skipped++; continue; }
    if (!optedIn(turnPrefs, t.beneficiary_user_id, "turn_started")) { skipped++; continue; }
    const groupName = t.groups?.name ?? "Tontine";
    const body =
      `Tontine ${groupName}: votre tour #${t.turn_number} arrive le ${t.due_date}. ` +
      `Cagnotte ≈ ${fmtSms(Number(t.payout_amount))} GNF.`;
    const r = await sendMessage({
      to: phone,
      body,
      logContext: {
        userId: t.beneficiary_user_id,
        groupId: t.group_id,
        turnId: t.id,
        kind: "turn_upcoming_j2",
      },
    });
    if (r.success) sentTurn++;
  }

  // ── 2. Cotisation due J-1 ───────────────────────────────────────────────
  // Join via turns pour la date d'échéance (contributions n'a pas de due_date).
  const { data: dueContribs, error: cErr } = await admin
    .from("contributions")
    .select(
      "id, amount, payer_user_id, group_id, turn_id, groups(name), turns!inner(turn_number, due_date)"
    )
    .eq("status", "pending")
    .eq("turns.due_date", target_due_date);
  if (cErr) console.error("[reminders] contributions fetch:", cErr);

  const dueUsers = Array.from(
    new Set((dueContribs ?? []).map((c: any) => c.payer_user_id)),
  );
  const duePhones = await loadPhones(admin, dueUsers);
  const duePrefs = await loadSmsPrefs(admin, dueUsers, ["contribution_due"]);

  for (const c of (dueContribs ?? []) as any[]) {
    const phone = duePhones.get(c.payer_user_id);
    if (!phone) { skipped++; continue; }
    if (!optedIn(duePrefs, c.payer_user_id, "contribution_due")) { skipped++; continue; }
    const groupName = c.groups?.name ?? "Tontine";
    const turnNumber = c.turns?.turn_number ?? "";
    const body =
      `Tontine ${groupName}: cotisation de ${fmtSms(Number(c.amount))} GNF ` +
      `due demain (tour #${turnNumber}). Payez via l'app.`;
    const r = await sendMessage({
      to: phone,
      body,
      logContext: {
        userId: c.payer_user_id,
        groupId: c.group_id,
        turnId: c.turn_id,
        kind: "contribution_due_j1",
      },
    });
    if (r.success) sentContribution++;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      target_turn_date,
      target_due_date,
      sent: { turn_upcoming_j2: sentTurn, contribution_due_j1: sentContribution },
      skipped,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});