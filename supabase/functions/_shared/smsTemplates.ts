/**
 * smsTemplates — fabrique pure des messages SMS Tontine Digitale.
 *
 * Doctrine Paxefy : catalogue fixe, pas d'effets de bord, testable unitairement.
 * Toute la mise en forme (montant, date, prénoms, accents) vit ici afin que
 * les tests d'intégration puissent vérifier le contenu et les métadonnées du SMS
 * sans dépendre de Supabase ni de Nimba.
 */

export interface SmsMessage {
  body: string;
  /** Métadonnées routées vers nimbasms.logSmsAttempt / sms_logs. */
  meta: {
    userId: string;
    groupId: string | null;
    turnId: string | null;
    kind: string;
    dedupeKey: string;
  };
}

export function fmtGNF(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0 GNF";
  return `${Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0")} GNF`;
}

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function firstName(full?: string | null): string {
  if (!full) return "Un membre";
  const tok = full.trim().split(/\s+/);
  const first = tok[0] ?? "";
  const initial = tok[1]?.[0];
  return stripAccents(initial ? `${first} ${initial}.` : first);
}

export function fmtDateFR(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export function makeRef(): string {
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

// ── Templates ─────────────────────────────────────────────────────────

export function buildContributionConfirmedSms(args: {
  payerUserId: string;
  contributionId: string | null;
  turnId: string;
  groupId: string | null;
  groupName: string;
  amount: number;
  turnNumber: number | string;
  beneficiaryFullName: string | null;
  dueDate: string | null;
  paidCount: number;
  totalCount: number;
  ref: string;
}): SmsMessage {
  const benefName = firstName(args.beneficiaryFullName);
  const due = fmtDateFR(args.dueDate);
  const body =
    `Bonjour, votre cotisation de ${fmtGNF(args.amount)} pour la tontine ` +
    `"${stripAccents(args.groupName)}" (tour #${args.turnNumber}, ` +
    `beneficiaire ${benefName}) a ete confirmee. ` +
    `${args.paidCount}/${args.totalCount} membres ont cotise. ` +
    `Echeance: ${due}. Ref: ${args.ref}. Tontine Digitale vous remercie.`;
  return {
    body,
    meta: {
      userId: args.payerUserId,
      groupId: args.groupId,
      turnId: args.turnId,
      kind: "contribution_confirmed",
      dedupeKey: `contrib_confirmed:${args.contributionId ?? `${args.turnId}:${args.payerUserId}`}`,
    },
  };
}

export function buildBeneficiaryPaymentReceivedSms(args: {
  beneficiaryUserId: string;
  beneficiaryFullName: string | null;
  payerFullName: string | null;
  contributionId: string;
  turnId: string;
  groupId: string | null;
  groupName: string;
  amount: number;
  turnNumber: number | string;
  /** Plus proche due_date où le bénéficiaire est lui-même payer pending (ISO yyyy-mm-dd). */
  nextDueDate: string | null;
  ref: string;
}): SmsMessage {
  const benefFirst = firstName(args.beneficiaryFullName);
  const payerFirst = firstName(args.payerFullName);
  const nextDue = args.nextDueDate ? fmtDateFR(args.nextDueDate) : null;
  const tail = nextDue
    ? `Votre prochaine cotisation est due le ${nextDue}.`
    : `Vous serez notifie de votre prochaine cotisation.`;
  const body =
    `Bonjour ${benefFirst}, ${payerFirst} vient de payer sa cotisation de ` +
    `${fmtGNF(args.amount)} pour votre tour #${args.turnNumber} de la tontine ` +
    `"${stripAccents(args.groupName)}". ${tail} Ref: ${args.ref}. ` +
    `Tontine Digitale vous informe.`;
  return {
    body,
    meta: {
      userId: args.beneficiaryUserId,
      groupId: args.groupId,
      turnId: args.turnId,
      kind: "beneficiary_payment_received",
      dedupeKey: `bnpr:${args.contributionId}:${args.beneficiaryUserId}`,
    },
  };
}

export function buildTurnPaidSms(args: {
  beneficiaryUserId: string;
  turnId: string;
  groupId: string | null;
  groupName: string;
  turnNumber: number | string;
  amount: number;
  ref: string;
}): SmsMessage {
  const body =
    `Bonjour, le tour #${args.turnNumber} de la tontine ` +
    `"${stripAccents(args.groupName)}" est cloture. ` +
    `Montant credite sur votre solde Tontine Digitale: ${fmtGNF(args.amount)}. ` +
    `Demandez votre retrait depuis l'application. Ref: ${args.ref}. ` +
    `Tontine Digitale vous remercie.`;
  return {
    body,
    meta: {
      userId: args.beneficiaryUserId,
      groupId: args.groupId,
      turnId: args.turnId,
      kind: "payout_released",
      dedupeKey: `turn_paid:${args.turnId}`,
    },
  };
}