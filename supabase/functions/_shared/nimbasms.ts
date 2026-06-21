/**
 * Nimba SMS service — Deno Edge Functions (Tontine Digitale)
 *
 * Envoie des SMS via l'API REST Nimba SMS v1.
 * Auth: HTTP Basic base64(service_id:secret_token)
 *
 * Env vars requises:
 *   NIMBA_SERVICE_ID      — Service ID (onglet API KEYS)
 *   NIMBA_SECRET_TOKEN    — Secret Token (onglet API KEYS)
 *
 * Env vars optionnelles:
 *   NIMBA_SENDER_NAME     — Nom d'expéditeur enregistré (défaut: "Tontine")
 *   SMS_ENABLED           — "false" pour désactiver tous les envois
 *
 * Formats de numéro acceptés:
 *   6XXXXXXXX / 224XXXXXXXXX / +224XXXXXXXXX
 *   (utiliser normalizeGNPhone() ci-dessous avant l'envoi)
 */

const NIMBA_API_BASE = "https://api.nimbasms.com/v1";
const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Formateur de montant pour SMS (ex: 1500000 → "1 500 000"). */
export function fmtSms(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
}

/**
 * Normalise un numéro guinéen au format Nimba (224XXXXXXXXX, sans "+").
 * Renvoie null si le numéro n'est pas exploitable.
 */
export function normalizeGNPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/[\s\-().+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("00224")) return `224${digits.slice(5)}`;
  if (digits.startsWith("224")) return digits;
  // Format local guinéen (9 chiffres commençant par 6)
  if (/^6\d{8}$/.test(digits)) return `224${digits}`;
  return null;
}

export type NimbaChannel = "sms" | "whatsapp" | "email";

export interface SendMessageParams {
  /** Numéro(s) destinataire(s) — jusqu'à 30 par requête. */
  to: string | string[];
  /** Contenu du message (≤ 160 chars = 1 SMS, max 665 chars = 5 SMS). */
  body: string;
  /** Canal d'envoi (défaut: 'sms'). */
  channel?: NimbaChannel;
  /** Surcharge le NIMBA_SENDER_NAME pour ce message. */
  senderName?: string;
}

export interface MessageResult {
  success: boolean;
  messageId?: string;
  messageCost?: number;
  error?: string;
}

/**
 * Envoie un message via Nimba SMS.
 * Ne lance jamais d'exception — retourne toujours { success, error? }.
 */
export async function sendMessage(params: SendMessageParams): Promise<MessageResult> {
  if (Deno.env.get("SMS_ENABLED") === "false") {
    console.log("[NimbaSMS] Désactivé via SMS_ENABLED=false");
    return { success: true };
  }

  const serviceId = Deno.env.get("NIMBA_SERVICE_ID");
  const secretToken = Deno.env.get("NIMBA_SECRET_TOKEN");
  const senderName =
    params.senderName ?? Deno.env.get("NIMBA_SENDER_NAME") ?? "Tontine";
  const channel: NimbaChannel = params.channel ?? "sms";

  if (!serviceId || !secretToken) {
    console.error(
      "[NimbaSMS] Credentials manquants. " +
        "Configurez NIMBA_SERVICE_ID et NIMBA_SECRET_TOKEN dans les Supabase Secrets.",
    );
    return { success: false, error: "Nimba SMS credentials not configured" };
  }

  const raw = Array.isArray(params.to) ? params.to : [params.to];
  const recipients = raw
    .map((n) => normalizeGNPhone(n) ?? n.replace(/[\s\-().]/g, ""))
    .filter(Boolean);

  if (recipients.length === 0) {
    return { success: false, error: "Aucun destinataire fourni" };
  }
  if (recipients.length > 30) {
    console.warn(`[NimbaSMS] ${recipients.length} destinataires > 30 — tronqué à 30`);
    recipients.splice(30);
  }

  const basicAuth = btoa(`${serviceId}:${secretToken}`);
  const url = `${NIMBA_API_BASE}/messages`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender_name: senderName,
          to: recipients,
          message: params.body,
          channel,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 201) {
        console.log(
          `[NimbaSMS] Envoyé (tentative ${attempt}) → to=${recipients.join(",")} ` +
            `id=${data.messageid} coût=${data.message_cost} SMS`,
        );
        return {
          success: true,
          messageId: data.messageid,
          messageCost: data.message_cost,
        };
      }

      if (res.status === 420 || res.status === 429) {
        console.warn(`[NimbaSMS] Rate limit (${res.status}), tentative ${attempt}/${MAX_RETRIES}`);
        if (attempt < MAX_RETRIES) {
          await sleep(attempt * 2_000);
          continue;
        }
        return { success: false, error: "Nimba SMS rate limit dépassé" };
      }

      const errDetail = Array.isArray(data)
        ? data[0]?.detail
        : (data?.detail ?? JSON.stringify(data));
      console.error(`[NimbaSMS] Erreur API (${res.status}): ${errDetail}`, `to=${recipients}`);
      if (res.status < 500) {
        return { success: false, error: `NimbaSMS ${res.status}: ${errDetail}` };
      }

      if (attempt < MAX_RETRIES) {
        await sleep(attempt * 1_500);
        continue;
      }
      return { success: false, error: `NimbaSMS ${res.status}: ${errDetail}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[NimbaSMS] Erreur réseau (tentative ${attempt}):`, msg);
      if (attempt === MAX_RETRIES) return { success: false, error: msg };
      await sleep(attempt * 1_000);
    }
  }

  return { success: false, error: "NimbaSMS: max retries dépassé" };
}

/** Envoi en arrière-plan (fire-and-forget). */
export function sendMessageBg(params: SendMessageParams): void {
  sendMessage(params)
    .then((result) => {
      if (!result.success) {
        const dest = Array.isArray(params.to) ? params.to.join(",") : params.to;
        console.error(`[NimbaSMS] Envoi BG échoué to=${dest}:`, result.error);
      }
    })
    .catch((err) => {
      console.error("[NimbaSMS] Envoi BG exception:", err);
    });
}