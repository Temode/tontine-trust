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
import { fmtSms, logSmsAttempt, normalizeGNPhone, sendMessage } from "../_shared/nimbasms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function addDaysISO(days: number, base?: string): string {
  const d = base ? new Date(`${base}T00:00:00Z`) : new Date();
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

function fmtDateFR(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function buildReminderSms(args: {
  groupName: string;
  turnNumber: number | string;
  dueDate: string;
  amount: number;
  expectedPenalty: number;
  latePct: number;
  bucket: string;
  daysLate: number;
}): string {
  const { groupName, turnNumber, dueDate, amount, expectedPenalty, latePct, bucket, daysLate } = args;
  const amt = `${fmtSms(amount)} GNF`;
  const pen = expectedPenalty > 0
    ? ` Pénalité encourue ${fmtSms(expectedPenalty)} GNF (${latePct}%).`
    : "";
  if (bucket === "J-2" || bucket === "J-1") {
    const j = bucket === "J-2" ? "dans 2 jours" : "demain";
    return `Tontine Digitale : cotisation ${amt} pour le groupe « ${groupName} » (tour #${turnNumber}) due ${j} le ${fmtDateFR(dueDate)}. Reglez via l'app pour eviter toute penalite.`;
  }
  if (bucket === "J0") {
    return `Tontine Digitale : votre cotisation ${amt} (groupe « ${groupName} », tour #${turnNumber}) est due aujourd'hui ${fmtDateFR(dueDate)}.${pen} Reglez via l'app.`;
  }
  // J+1, J+3
  if (bucket === "J+1" || bucket === "J+3") {
    return `Tontine Digitale : cotisation en retard de ${daysLate} j (groupe « ${groupName} », tour #${turnNumber}, ${amt}).${pen} Reglez sans delai via l'app.`;
  }
  if (bucket === "J+7") {
    return `Tontine Digitale : ${daysLate} j de retard sur le tour #${turnNumber} du groupe « ${groupName} » (${amt}).${pen} Un signalement vient d'etre transmis aux organisateurs. Reglez pour eviter la suspension.`;
  }
  // J+14
  return `Tontine Digitale : 14 j de retard sur le tour #${turnNumber} du groupe « ${groupName} » (${amt}).${pen} Vos droits (vote, encheres) sont desormais suspendus jusqu'au reglement.`;
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

  // Optional: ?dry_run=true&date=YYYY-MM-DD (referenced "today" for preview)
  const u = new URL(req.url);
  let dryRun = u.searchParams.get("dry_run") === "true";
  let baseDate: string | undefined = u.searchParams.get("date") ?? undefined;
  let triggeredBy: string | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body?.dry_run === true) dryRun = true;
      if (typeof body?.date === "string") baseDate = body.date;
      if (typeof body?.triggered_by === "string") triggeredBy = body.triggered_by;
    } catch { /* ignore */ }
  }

  const target_turn_date = addDaysISO(2, baseDate); // J-2 prochain tour
  const target_due_date = addDaysISO(1, baseDate); // J-1 cotisation due

  let sentTurn = 0;
  let sentContribution = 0;
  let skipped = 0;
  const previewTurn: Array<Record<string, unknown>> = [];
  const previewContribution: Array<Record<string, unknown>> = [];

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
    const reason =
      !phone ? "no_phone" : !optedIn(turnPrefs, t.beneficiary_user_id, "turn_started") ? "opted_out" : null;
    const groupName = t.groups?.name ?? "Tontine";
    const body =
      `Tontine ${groupName}: votre tour #${t.turn_number} arrive le ${t.due_date}. ` +
      `Cagnotte ≈ ${fmtSms(Number(t.payout_amount))} GNF.`;
    if (dryRun) {
      previewTurn.push({
        turn_id: t.id,
        group_id: t.group_id,
        group_name: groupName,
        turn_number: t.turn_number,
        due_date: t.due_date,
        beneficiary_user_id: t.beneficiary_user_id,
        phone,
        body,
        would_send: !reason,
        skip_reason: reason,
      });
      await logSmsAttempt(
        {
          userId: t.beneficiary_user_id,
          groupId: t.group_id,
          turnId: t.id,
          kind: "preview_j2",
          triggeredBy,
        },
        [phone ?? "—"],
        [phone ?? "—"],
        body,
        { status: "skipped", error: reason ? `dry_run:${reason}` : `dry_run:would_send@${baseDate ?? "today"}` },
      );
      continue;
    }
    if (reason) { skipped++; continue; }
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

  // ── 2. Rappels de cotisation (tous buckets) ─────────────────────────────
  // Lit la vue pending_reminders_view qui calcule jour/bucket/pénalité côté SQL.
  // Idempotence : on saute l'envoi SMS si reminder_log a déjà cette ligne aujourd'hui.
  const today = baseDate ?? new Date().toISOString().slice(0, 10);
  const { data: pending, error: pErr } = await admin
    .from("pending_reminders_view")
    .select(
      "contribution_id, payer_user_id, group_id, group_name, turn_id, turn_number, due_date, amount, late_penalty_percent, expected_penalty, days_late, bucket",
    )
    .not("bucket", "is", null);
  if (pErr) console.error("[reminders] pending view:", pErr);

  const dueUsers = Array.from(
    new Set((pending ?? []).map((c: any) => c.payer_user_id)),
  );
  const duePhones = await loadPhones(admin, dueUsers);
  const duePrefs = await loadSmsPrefs(admin, dueUsers, ["contribution_due"]);

  const sentByBucket: Record<string, number> = {};

  for (const c of (pending ?? []) as any[]) {
    const phone = duePhones.get(c.payer_user_id);
    const body = buildReminderSms({
      groupName: c.group_name ?? "Tontine",
      turnNumber: c.turn_number,
      dueDate: c.due_date,
      amount: Number(c.amount),
      expectedPenalty: Number(c.expected_penalty ?? 0),
      latePct: Number(c.late_penalty_percent ?? 0),
      bucket: c.bucket,
      daysLate: Number(c.days_late ?? 0),
    });

    if (dryRun) {
      previewContribution.push({
        contribution_id: c.contribution_id,
        group_id: c.group_id,
        group_name: c.group_name,
        turn_id: c.turn_id,
        turn_number: c.turn_number,
        bucket: c.bucket,
        days_late: c.days_late,
        expected_penalty: Number(c.expected_penalty ?? 0),
        payer_user_id: c.payer_user_id,
        amount: Number(c.amount),
        phone,
        body,
        would_send: !!phone && optedIn(duePrefs, c.payer_user_id, "contribution_due"),
      });
      continue;
    }

    // Idempotence SMS : déjà loggué aujourd'hui pour ce bucket ?
    const { count } = await admin
      .from("sms_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", c.payer_user_id)
      .eq("turn_id", c.turn_id)
      .eq("kind", `contribution_due_${c.bucket}`)
      .gte("created_at", `${today}T00:00:00Z`);
    if ((count ?? 0) > 0) continue;

    const reason = !phone
      ? "no_phone"
      : !optedIn(duePrefs, c.payer_user_id, "contribution_due")
      ? "opted_out"
      : null;
    if (reason) { skipped++; continue; }

    const r = await sendMessage({
      to: phone,
      body,
      logContext: {
        userId: c.payer_user_id,
        groupId: c.group_id,
        turnId: c.turn_id,
        kind: `contribution_due_${c.bucket}`,
      },
    });
    if (r.success) {
      sentContribution++;
      sentByBucket[c.bucket] = (sentByBucket[c.bucket] ?? 0) + 1;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      dry_run: dryRun,
      base_date: baseDate ?? new Date().toISOString().slice(0, 10),
      target_turn_date,
      target_due_date,
      sent: { turn_upcoming_j2: sentTurn, contribution_due_j1: sentContribution },
      skipped,
      ...(dryRun
        ? {
            preview: {
              turn_upcoming_j2: previewTurn,
              contribution_due_j1: previewContribution,
            },
          }
        : {}),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});