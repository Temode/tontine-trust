import { supabase } from "@/integrations/supabase/client";

export type DjomyMethod = "OM" | "MOMO" | "CARD";

export interface InitPaymentResult {
  paymentId: string;
  transactionId: string;
  redirectUrl: string;
}

export async function initDjomyPayment(input: {
  contributionId: string;
  method: DjomyMethod;
  payerPhone: string;
}): Promise<InitPaymentResult> {
  const origin = window.location.origin;
  const returnUrl = `${origin}/payment/return`;
  const cancelUrl = `${origin}/payment/cancel`;

  const { data, error } = await supabase.functions.invoke<InitPaymentResult | { error: string }>(
    "djomy-init-payment",
    { body: { ...input, returnUrl, cancelUrl } },
  );
  if (error) throw error;
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