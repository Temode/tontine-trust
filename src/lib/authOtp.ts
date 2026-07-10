import { supabase } from "@/integrations/supabase/client";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_action: "Action invalide.",
  invalid_email: "Email invalide.",
  invalid_payload: "Informations invalides.",
  weak_password: "Mot de passe trop faible (au moins 8 caractères).",
  email_exists: "Cet email est déjà utilisé. Connecte-toi.",
  rate_limited: "Trop d'emails envoyés. Patiente quelques minutes.",
  email_send_failed: "Impossible d'envoyer l'email pour le moment.",
  email_not_configured: "Le service email n'est pas encore configuré.",
  invalid_code: "Code invalide ou expiré. Vérifiez vos 6 chiffres.",
  code_expired: "Ce code a expiré. Cliquez sur « Renvoyer le code » pour en recevoir un nouveau.",
  code_already_used: "Ce code a déjà été utilisé. Demandez un nouveau code pour continuer.",
  password_update_failed: "Impossible de mettre à jour le mot de passe.",
  server_error: "Erreur serveur. Réessaie dans un instant.",
};

export function mapAuthOtpError(error?: string | null): string {
  if (!error) return ERROR_MESSAGES.server_error;
  return ERROR_MESSAGES[error] ?? error;
}

async function readInvokeError(error: unknown): Promise<string> {
  const err = error as { message?: string; context?: { text?: () => Promise<string> } };
  if (err?.context?.text) {
    try {
      const raw = await err.context.text();
      const parsed = JSON.parse(raw) as { error?: string; message?: string };
      return mapAuthOtpError(parsed.error ?? parsed.message ?? err.message);
    } catch {
      return mapAuthOtpError(err.message);
    }
  }
  return mapAuthOtpError(err?.message);
}

export async function invokeAuthOtp<T = Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke("auth-otp", { body });
  if (error) return { data: null, error: await readInvokeError(error) };

  const payload = data as ({ error?: string } & T) | null;
  if (payload?.error) return { data: null, error: mapAuthOtpError(payload.error) };
  return { data: payload as T, error: null };
}