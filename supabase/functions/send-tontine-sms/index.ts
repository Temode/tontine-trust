/**
 * send-tontine-sms — envoi temps réel des SMS de cycle de vie tontine.
 *
 * Appelé exclusivement par les triggers Postgres via pg_net.
 * Auth: en-tête X-Internal-Token validé contre public.internal_config.
 *
 * Body JSON: { kind, group_id, ... } (cf. triggers du fichier db/48).
 *   - "contribution_confirmed"  → SMS payeur + relance autres membres pending
 *   - "turn_paid"               → SMS bénéficiaire
 *   - "cycle_completed"         → SMS organisateur + co-organisateurs
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  logSmsAttempt,
  normalizeGNPhone,
  sendMessage,
} from "../_shared/nimbasms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-internal-token, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Helpers de formatage style opérateur ──────────────────────────────
function fmtGNF(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0 GNF";
  return `${Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0")} GNF`;
}
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function firstName(full?: string | null): string {
  if (!full) return "Un membre";
  const tok = full.trim().split(/\s+/);
  const first = tok[0] ?? "";
  const initial = tok[1]?.[0];
  return stripAccents(initial ? `${first} ${initial}.` : first);
}
function fmtDateFR(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}
function makeRef(): string {
  const d = new Date();
  const yy = String(d.getUTCFullYear()).slice(2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(3)))
    .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
    .join("");
  return `TD${yy}${mm}${dd}.${hh}${mi}.${rand}`;
}

type Admin = ReturnType<typeof createClient>;

/**
 * Verrou anti-doublon atomique côté base.
 * Retourne true si la clé a été réservée (envoi autorisé),
 * false si déjà utilisée (envoi à sauter).
 */
async function claimDedupe(admin: Admin, key: string): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("claim_sms_dedupe", { _key: key });
    if (error) {
      console.error("[send-tontine-sms] claim_sms_dedupe failed:", error);
      // En cas d'erreur RPC, on autorise l'envoi pour ne pas bloquer
      // la communication critique (la table sms_logs gardera trace du doublon).
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error("[send-tontine-sms] claim_sms_dedupe exception:", e);
    return true;
  }
}

function isBalanceError(err?: string | null): boolean {
  if (!err) return false;
  const s = err.toLowerCase();
  return (
    s.includes("solde") ||
    s.includes("insufficient") ||
    s.includes("balance") ||
    s.includes("insuffisant")
  );
}

async function notifyAdminsSmsFailure(
  admin: Admin,
  args: {
    groupId: string | null;
    turnId: string | null;
    kind: string;
    userId: string;
    error: string;
  },
) {
  try {
    const { data: admins } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const recipients = (admins ?? []).map((r: any) => r.user_id as string);
    if (recipients.length === 0) return;
    const isBalance = isBalanceError(args.error);
    const title = isBalance ? "Solde SMS épuisé" : "Échec d'envoi SMS";
    const body = isBalance
      ? `Le solde NimbaSMS est insuffisant — un SMS "${args.kind}" n'a pas pu être livré. Rechargez le compte opérateur.`
      : `Échec d'envoi SMS "${args.kind}" : ${args.error}`;
    const rows = recipients.map((uid) => ({
      user_id: uid,
      kind: "sms_delivery_failed",
      title,
      body,
      group_id: args.groupId,
      turn_id: args.turnId,
      link: "/admin/sms",
      data: {
        target_user_id: args.userId,
        sms_kind: args.kind,
        error: args.error,
        balance_exhausted: isBalance,
      },
    }));
    await admin.from("notifications").insert(rows);
  } catch (e) {
    console.error("[send-tontine-sms] notifyAdminsSmsFailure failed:", e);
  }
}

async function isSmsOptedIn(
  admin: Admin,
  userId: string,
  kind: string,
): Promise<boolean> {
  const { data } = await admin
    .from("notification_preferences")
    .select("enabled")
    .eq("user_id", userId)
    .eq("channel", "sms")
    .eq("notif_type", kind)
    .maybeSingle();
  return data?.enabled !== false; // défaut ON
}

async function getProfile(admin: Admin, userId: string) {
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, phone_number")
    .eq("id", userId)
    .maybeSingle();
  return data as { id: string; full_name: string | null; phone_number: string | null } | null;
}

async function sendOne(args: {
  admin: Admin;
  userId: string;
  groupId: string | null;
  turnId: string | null;
  kind: string;
  body: string;
  dedupeKey?: string | null;
}) {
  // 0) Verrou anti-doublon AVANT tout (atomique, ne dépend pas de sms_logs)
  if (args.dedupeKey) {
    const ok = await claimDedupe(args.admin, args.dedupeKey);
    if (!ok) {
      return { sent: false, reason: "dedupe" };
    }
  }
  const profile = await getProfile(args.admin, args.userId);
  const phone = normalizeGNPhone(profile?.phone_number);
  if (!phone) {
    await logSmsAttempt(
      { userId: args.userId, groupId: args.groupId, turnId: args.turnId, kind: args.kind },
      [profile?.phone_number ?? "—"],
      [profile?.phone_number ?? "—"],
      args.body,
      { status: "skipped", error: "no_phone" },
    );
    return { sent: false, reason: "no_phone" };
  }
  const optIn = await isSmsOptedIn(args.admin, args.userId, args.kind);
  if (!optIn) {
    await logSmsAttempt(
      { userId: args.userId, groupId: args.groupId, turnId: args.turnId, kind: args.kind },
      [phone], [phone], args.body,
      { status: "skipped", error: "opted_out" },
    );
    return { sent: false, reason: "opted_out" };
  }
  const r = await sendMessage({
    to: phone,
    body: args.body,
    logContext: {
      userId: args.userId,
      groupId: args.groupId,
      turnId: args.turnId,
      kind: args.kind,
    },
  });
  // Si échec : alerte admin (et marque balance_exhausted si solde Nimba épuisé)
  if (!r.success) {
    await notifyAdminsSmsFailure(args.admin, {
      groupId: args.groupId,
      turnId: args.turnId,
      kind: args.kind,
      userId: args.userId,
      error: r.error ?? "unknown",
    });
  }
  return { sent: r.success, reason: r.error };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "server_misconfigured" }, 500);
  const admin = createClient(url, key);

  // ── Auth interne : valide X-Internal-Token contre internal_config ──
  const provided = req.headers.get("X-Internal-Token") ?? req.headers.get("x-internal-token");
  const { data: cfg } = await admin
    .from("internal_config")
    .select("value")
    .eq("key", "tontine_sms_token")
    .maybeSingle();
  const expected = (cfg as { value?: string } | null)?.value;
  if (!expected || !provided || provided !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const kind = String(payload.kind ?? "");
  const groupId = (payload.group_id as string | undefined) ?? null;

  // Charge le groupe (nom)
  const { data: group } = groupId
    ? await admin.from("groups").select("id, name, created_by").eq("id", groupId).maybeSingle()
    : { data: null };
  const gname = stripAccents((group as { name?: string } | null)?.name ?? "Tontine");

  const ref = makeRef();
  const results: Array<Record<string, unknown>> = [];

  // ─────────────────────────────────────────────────────────────────────
  if (kind === "contribution_confirmed") {
    const turnId = payload.turn_id as string;
    const contributionId = (payload.contribution_id as string | undefined) ?? null;
    const payerId = payload.payer_user_id as string;
    const amount = Number(payload.amount ?? 0);

    const { data: turn } = await admin
      .from("turns")
      .select("id, turn_number, due_date, beneficiary_user_id")
      .eq("id", turnId)
      .maybeSingle();

    const { data: contribs } = await admin
      .from("contributions")
      .select("payer_user_id, status")
      .eq("turn_id", turnId);

    const total = contribs?.length ?? 0;
    const paidCount = (contribs ?? []).filter((c: any) => c.status === "confirmed").length;
    const pendingPayers = (contribs ?? [])
      .filter((c: any) => c.status !== "confirmed")
      .map((c: any) => c.payer_user_id as string)
      .filter((id: string) => id !== payerId);

    const benefName = turn?.beneficiary_user_id
      ? firstName((await getProfile(admin, turn.beneficiary_user_id))?.full_name)
      : "—";
    const payerName = firstName((await getProfile(admin, payerId))?.full_name);
    const due = fmtDateFR(turn?.due_date);
    const turnNo = turn?.turn_number ?? "?";

    // SMS 1 — confirmation au payeur
    const body1 =
      `Bonjour, votre cotisation de ${fmtGNF(amount)} pour la tontine "${gname}" ` +
      `(tour #${turnNo}, beneficiaire ${benefName}) a ete confirmee. ` +
      `${paidCount}/${total} membres ont cotise. Echeance: ${due}. ` +
      `Ref: ${ref}. Tontine Digitale vous remercie.`;
    results.push({
      target: "payer",
      user: payerId,
      ...(await sendOne({
        admin,
        userId: payerId,
        groupId,
        turnId,
        kind: "contribution_confirmed",
        body: body1,
        dedupeKey: `contrib_confirmed:${contributionId ?? `${turnId}:${payerId}`}`,
      })),
    });

    // SMS 2 — relance aux autres membres encore pending
    for (const uid of pendingPayers) {
      const { data: c } = await admin
        .from("contributions")
        .select("amount")
        .eq("turn_id", turnId)
        .eq("payer_user_id", uid)
        .maybeSingle();
      const ownAmount = Number((c as { amount?: number } | null)?.amount ?? amount);
      const body2 =
        `Bonjour, ${payerName} vient de cotiser pour la tontine "${gname}" (tour #${turnNo}). ` +
        `Votre cotisation de ${fmtGNF(ownAmount)} reste due le ${due}. ` +
        `Reglez depuis l'application. Ref: ${ref}. Tontine Digitale vous informe.`;
      results.push({
        target: "pending_member",
        user: uid,
        ...(await sendOne({
          admin,
          userId: uid,
          groupId,
          turnId,
          kind: "contribution_due",
          body: body2,
          dedupeKey: `contrib_notify:${contributionId ?? `${turnId}:${payerId}`}:${uid}`,
        })),
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  else if (kind === "turn_paid") {
    const turnId = payload.turn_id as string;
    const turnNo = payload.turn_number ?? "?";
    const benefId = payload.beneficiary_user_id as string;
    const amount = Number(payload.amount ?? 0);

    const body =
      `Bonjour, le tour #${turnNo} de la tontine "${gname}" est cloture. ` +
      `Montant credite sur votre solde Tontine Digitale: ${fmtGNF(amount)}. ` +
      `Demandez votre retrait depuis l'application. Ref: ${ref}. Tontine Digitale vous remercie.`;
    results.push({
      target: "beneficiary",
      user: benefId,
      ...(await sendOne({
        admin,
        userId: benefId,
        groupId,
        turnId,
        kind: "payout_released",
        body,
        dedupeKey: `turn_paid:${turnId}`,
      })),
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  else if (kind === "payout_hold_extended") {
    const turnId = payload.turn_id as string;
    const turnNo = payload.turn_number ?? "?";
    const benefId = payload.beneficiary_user_id as string;
    const amount = Number(payload.amount ?? 0);
    const holdUntil = payload.hold_until as string;
    const releaseDate = fmtDateFR(holdUntil);

    const body =
      `Bonjour, le tour #${turnNo} de la tontine "${gname}" est cloture. ` +
      `Montant credite sur votre solde : ${fmtGNF(amount)}. ` +
      `Suite a un retard de cotisation ce cycle, la liberation de vos fonds est repoussee au ${releaseDate}. ` +
      `Ref: ${ref}. Tontine Digitale vous informe.`;
    results.push({
      target: "beneficiary",
      user: benefId,
      ...(await sendOne({
        admin,
        userId: benefId,
        groupId,
        turnId,
        kind: "payout_hold_extended",
        body,
        dedupeKey: `hold_extended:${turnId}:${holdUntil}`,
      })),
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  else if (kind === "cycle_completed") {
    const createdBy = (group as { created_by?: string } | null)?.created_by;
    const recipients = new Set<string>();
    if (createdBy) recipients.add(createdBy);

    // Co-organisateurs
    const { data: admins } = groupId
      ? await admin
          .from("group_admin_permissions")
          .select("user_id")
          .eq("group_id", groupId)
      : { data: [] as Array<{ user_id: string }> };
    for (const row of (admins ?? []) as Array<{ user_id: string }>) {
      if (row.user_id) recipients.add(row.user_id);
    }

    const body =
      `Bonjour, le cycle de la tontine "${gname}" est termine. ` +
      `Tous les versements ont ete effectues. ` +
      `Vous pouvez relancer un cycle, ajuster les regles ou inviter de nouveaux membres ` +
      `depuis l'application. Ref: ${ref}. Tontine Digitale vous informe.`;

    for (const uid of recipients) {
      results.push({
        target: "organizer",
        user: uid,
        ...(await sendOne({
          admin,
          userId: uid,
          groupId,
          turnId: null,
          kind: "cycle_completed",
          body,
          dedupeKey: `cycle_completed:${groupId ?? "-"}:${uid}`,
        })),
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Branche générique : payload { kind, sms_kind, recipients:[user_ids], body, group_id?, turn_id? }
  // Utilisée par les triggers SMS étendus (retraits, validations admin, cycle, etc.)
  else if (kind === "generic_broadcast") {
    const smsKind = String(payload.sms_kind ?? "system");
    const recipients = Array.isArray(payload.recipients)
      ? (payload.recipients as string[])
      : [];
    const body = String(payload.body ?? "").trim();
    const turnId = (payload.turn_id as string | undefined) ?? null;
    if (!body) return json({ error: "missing_body" }, 400);
    for (const uid of recipients) {
      if (!uid) continue;
      results.push({
        target: smsKind,
        user: uid,
        ...(await sendOne({
          admin,
          userId: uid,
          groupId,
          turnId,
          kind: smsKind,
          body,
        })),
      });
    }
  }

  else {
    return json({ error: "unknown_kind", kind }, 400);
  }

  return json({ ok: true, kind, ref, results });
});