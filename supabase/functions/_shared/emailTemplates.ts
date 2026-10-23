/**
 * emailTemplates.ts — catalogue figé des emails Tontine Digitale.
 * Doctrine (miroir de smsTemplates.ts) : un renderer par kind, palette
 * bleu sarcelle #0D7377 + or #E8AA14, français, tutoiement.
 */

export type EmailKind =
  | "contribution_confirmed"
  | "beneficiary_payment_received"
  | "turn_started"
  | "manual_reminder";

export interface RenderedEmail { subject: string; html: string; text: string }

interface Common { recipientName?: string | null; groupName: string }
export interface ContributionConfirmedVars extends Common { amountFcfa: number; turnNumber: number }
export interface BeneficiaryPaymentReceivedVars extends Common { payerName: string; amountFcfa: number; nextDueDate?: string | null }
export interface TurnStartedVars extends Common { amountFcfa: number; dueDate: string; turnNumber: number }
export interface ManualReminderVars extends Common { amountFcfa: number; dueDate: string; fromName: string }

const BRAND = { teal: "#0D7377", gold: "#E8AA14", ink: "#0F172A", muted: "#475569", bg: "#F8FAFC", card: "#FFFFFF" };
const APP_URL = "https://tontinedigitale.com";

const fmtGnf = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(n))) + " GNF";
const fmtDate = (iso: string) => {
  try { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(iso)); }
  catch { return iso; }
};
const hello = (name?: string | null) => (name ? `Bonjour ${name},` : "Bonjour,");

function shell(opts: { preview: string; title: string; bodyHtml: string; cta?: { label: string; href: string } }): string {
  const cta = opts.cta
    ? `<tr><td align="center" style="padding:24px 0 8px 0;"><a href="${opts.cta.href}" style="background:${BRAND.teal};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;">${opts.cta.label}</a></td></tr>`
    : "";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${opts.title}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
<div style="display:none;max-height:0;overflow:hidden;">${opts.preview}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.card};border-radius:12px;border-top:4px solid ${BRAND.teal};box-shadow:0 1px 3px rgba(15,23,42,.06);">
      <tr><td style="padding:28px 28px 8px 28px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:${BRAND.teal};text-transform:uppercase;">Tontine Digitale</div>
        <h1 style="margin:8px 0 0 0;font-size:20px;line-height:1.35;color:${BRAND.ink};">${opts.title}</h1>
      </td></tr>
      <tr><td style="padding:12px 28px 8px 28px;font-size:15px;line-height:1.6;color:${BRAND.ink};">${opts.bodyHtml}</td></tr>
      ${cta}
      <tr><td style="padding:24px 28px 28px 28px;border-top:1px solid #E2E8F0;font-size:12px;color:${BRAND.muted};">
        L'équipe Tontine Digitale — <a href="mailto:support@tontinedigitale.com" style="color:${BRAND.teal};text-decoration:none;">support@tontinedigitale.com</a><br>
        <span style="color:#94A3B8;">Tu reçois cet email parce que tu es membre d'un groupe sur Tontine Digitale.</span>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

function contributionConfirmed(v: ContributionConfirmedVars): RenderedEmail {
  return {
    subject: `✅ Cotisation confirmée — ${v.groupName}`,
    text: `${hello(v.recipientName)}\n\nTa cotisation de ${fmtGnf(v.amountFcfa)} pour le tour #${v.turnNumber} du groupe "${v.groupName}" est confirmée. Merci !\n\nRetrouve le reçu : ${APP_URL}/cotisations\n\n— L'équipe Tontine Digitale`,
    html: shell({
      preview: `Cotisation de ${fmtGnf(v.amountFcfa)} confirmée`,
      title: "Cotisation confirmée",
      bodyHtml: `<p>${hello(v.recipientName)}</p><p>Ta cotisation de <strong>${fmtGnf(v.amountFcfa)}</strong> pour le tour <strong>#${v.turnNumber}</strong> du groupe <strong>${v.groupName}</strong> est confirmée.</p><p style="color:${BRAND.muted};">Le reçu est disponible dans l'app.</p>`,
      cta: { label: "Voir mon reçu", href: `${APP_URL}/cotisations` },
    }),
  };
}

function beneficiaryPaymentReceived(v: BeneficiaryPaymentReceivedVars): RenderedEmail {
  const nextLine = v.nextDueDate ? `Prochaine échéance : ${fmtDate(v.nextDueDate)}.` : "";
  return {
    subject: `💰 ${v.payerName} a cotisé — ${v.groupName}`,
    text: `${hello(v.recipientName)}\n\n${v.payerName} vient de verser ${fmtGnf(v.amountFcfa)} pour le groupe "${v.groupName}". ${nextLine}\n\nSuivi : ${APP_URL}/mes-groupes\n\n— L'équipe Tontine Digitale`,
    html: shell({
      preview: `${v.payerName} a versé ${fmtGnf(v.amountFcfa)}`,
      title: "Nouveau versement reçu",
      bodyHtml: `<p>${hello(v.recipientName)}</p><p><strong>${v.payerName}</strong> vient de verser <strong>${fmtGnf(v.amountFcfa)}</strong> pour le groupe <strong>${v.groupName}</strong>.</p>${v.nextDueDate ? `<p>Prochaine échéance : <strong>${fmtDate(v.nextDueDate)}</strong>.</p>` : ""}`,
      cta: { label: "Voir le groupe", href: `${APP_URL}/mes-groupes` },
    }),
  };
}

function turnStarted(v: TurnStartedVars): RenderedEmail {
  return {
    subject: `🎯 C'est ton tour — ${v.groupName}`,
    text: `${hello(v.recipientName)}\n\nLe tour #${v.turnNumber} du groupe "${v.groupName}" est ouvert. Dépôt attendu : ${fmtGnf(v.amountFcfa)} avant le ${fmtDate(v.dueDate)}.\n\nPayer : ${APP_URL}/cotisations\n\n— L'équipe Tontine Digitale`,
    html: shell({
      preview: `Tour #${v.turnNumber} — ${fmtGnf(v.amountFcfa)} avant le ${fmtDate(v.dueDate)}`,
      title: "Ton tour est ouvert",
      bodyHtml: `<p>${hello(v.recipientName)}</p><p>Le tour <strong>#${v.turnNumber}</strong> du groupe <strong>${v.groupName}</strong> vient de démarrer.</p><p>Dépôt attendu : <strong>${fmtGnf(v.amountFcfa)}</strong> avant le <strong style="color:${BRAND.gold};">${fmtDate(v.dueDate)}</strong>.</p>`,
      cta: { label: "Payer ma cotisation", href: `${APP_URL}/cotisations` },
    }),
  };
}

function manualReminder(v: ManualReminderVars): RenderedEmail {
  return {
    subject: `🔔 Rappel — ${v.groupName}`,
    text: `${hello(v.recipientName)}\n\n${v.fromName} te rappelle ta cotisation de ${fmtGnf(v.amountFcfa)} pour le groupe "${v.groupName}", à régler avant le ${fmtDate(v.dueDate)}.\n\nPayer : ${APP_URL}/cotisations\n\n— L'équipe Tontine Digitale`,
    html: shell({
      preview: `${v.fromName} te rappelle une cotisation de ${fmtGnf(v.amountFcfa)}`,
      title: "Rappel de cotisation",
      bodyHtml: `<p>${hello(v.recipientName)}</p><p><strong>${v.fromName}</strong> te rappelle ta cotisation de <strong>${fmtGnf(v.amountFcfa)}</strong> pour le groupe <strong>${v.groupName}</strong>, à régler avant le <strong style="color:${BRAND.gold};">${fmtDate(v.dueDate)}</strong>.</p>`,
      cta: { label: "Payer maintenant", href: `${APP_URL}/cotisations` },
    }),
  };
}

export function renderEmail(kind: EmailKind, vars: Record<string, unknown>): RenderedEmail {
  switch (kind) {
    case "contribution_confirmed": return contributionConfirmed(vars as unknown as ContributionConfirmedVars);
    case "beneficiary_payment_received": return beneficiaryPaymentReceived(vars as unknown as BeneficiaryPaymentReceivedVars);
    case "turn_started": return turnStarted(vars as unknown as TurnStartedVars);
    case "manual_reminder": return manualReminder(vars as unknown as ManualReminderVars);
    default: { const k: never = kind; throw new Error(`unknown email kind: ${String(k)}`); }
  }
}

export const EMAIL_FROM = "Tontine Digitale <noreply@tontinedigitale.com>";
export const EMAIL_REPLY_TO = "support@tontinedigitale.com";
