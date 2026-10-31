import { supabase } from "@/integrations/supabase/client";

export const REFERRAL_KEY = "pending_referral_code";
export const REFERRAL_RESULT_KEY = "referral_claim_result";

/** Mémorise ?ref=CODE dès le chargement de l'app, avant toute redirection. */
export function captureReferralFromUrl(search: string = window.location.search): string | null {
  try {
    const ref = new URLSearchParams(search).get("ref");
    if (ref && /^[A-Za-z0-9]{4,16}$/.test(ref)) {
      const code = ref.toUpperCase();
      localStorage.setItem(REFERRAL_KEY, code);
      return code;
    }
  } catch { /* ignore */ }
  return null;
}

export type ReferralClaimResult = "ok" | "already_referred" | "self_referral" | "referrer_not_found" | "error";

export function mapReferralError(message: string): ReferralClaimResult {
  for (const k of ["already_referred", "self_referral", "referrer_not_found"] as const) {
    if (message.includes(k)) return k;
  }
  if (message.includes("invalid_code")) return "referrer_not_found";
  return "error";
}

/** Rattache le membre connecté au parrain mémorisé. Ne garde le code qu'en cas d'erreur réseau. */
export async function claimPendingReferral(): Promise<ReferralClaimResult | null> {
  let code: string | null = null;
  try { code = localStorage.getItem(REFERRAL_KEY); } catch { return null; }
  if (!code) return null;
  const { error } = await supabase.rpc("register_referral", { _code: code });
  const result: ReferralClaimResult = error ? mapReferralError(error.message) : "ok";
  if (result !== "error") localStorage.removeItem(REFERRAL_KEY);
  try { sessionStorage.setItem(REFERRAL_RESULT_KEY, result); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("referral-claimed", { detail: result }));
  return result;
}

export const REFERRAL_MESSAGES: Record<ReferralClaimResult, string> = {
  ok: "Parrainage enregistré : vous êtes maintenant rattaché à votre parrain.",
  already_referred: "Votre compte a déjà un parrain : un seul parrain est possible.",
  self_referral: "Vous ne pouvez pas utiliser votre propre lien de parrainage.",
  referrer_not_found: "Ce lien de parrainage n'est pas valide.",
  error: "Le parrainage n'a pas pu être enregistré. Nous réessaierons automatiquement.",
};
