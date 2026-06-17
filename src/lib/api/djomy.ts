import { supabase } from "@/integrations/supabase/client";

export type DjomyMethod = "OM" | "MOMO" | "CARD";

export interface InitPaymentResult {
  paymentId: string;
  transactionId: string;
  redirectUrl: string;
}

/**
 * Djomy exige des URL HTTPS pour returnUrl/cancelUrl.
 * En dev (http://localhost), on bascule sur l'URL Lovable publiée
 * (ou VITE_PUBLIC_APP_URL si défini).
 */
function getPublicAppBaseUrl(): string {
  const envBase = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return window.location.origin;
  }
  if (envBase && /^https:\/\//.test(envBase)) return envBase;
  return "https://tontine-digitale.lovable.app";
}

async function readFunctionError(error: unknown): Promise<string> {
  const err = error as { message?: string; context?: Response };
  try {
    const ctx = err?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.clone().json();
      const parts = [body?.error, body?.message, body?.hint, body?.details && JSON.stringify(body.details)]
        .filter(Boolean);
      if (parts.length) return parts.join(" — ");
    }
  } catch { /* ignore */ }
  return err?.message ?? "DJOMY_INIT_FAILED";
}

export async function initDjomyPayment(input: {
  contributionId: string;
  method: DjomyMethod;
  payerPhone: string;
}): Promise<InitPaymentResult> {
  const base = getPublicAppBaseUrl();
  const returnUrl = `${base}/payment/return`;
  const cancelUrl = `${base}/payment/cancel`;

  const { data, error } = await supabase.functions.invoke<InitPaymentResult | { error: string }>(
    "djomy-init-payment",
    { body: { ...input, returnUrl, cancelUrl } },
  );
  if (error) throw new Error(await readFunctionError(error));
  if (!data || "error" in data) {
    throw new Error((data as { error?: string })?.error ?? "DJOMY_INIT_FAILED");
  }
  return data as InitPaymentResult;
}

export interface PaymentStatusResult {
  paymentId: string;
  status: "initiated" | "pending" | "succeeded" | "failed" | "cancelled" | "refunded";
}

export async function getDjomyPaymentStatus(transactionId: string): Promise<PaymentStatusResult> {
  const { data, error } = await supabase.functions.invoke<PaymentStatusResult>(
    "djomy-payment-status",
    { body: { transactionId } },
  );
  if (error) throw error;
  return data as PaymentStatusResult;
}