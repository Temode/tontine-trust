import { supabase } from "@/integrations/supabase/client";

export interface SmsWallet {
  user_id: string;
  balance_remaining: number;
  total_purchased: number;
  total_consumed: number;
}

export interface SmsPack {
  id: string;
  qty: number;
  price: number;
  label?: string;
}

export interface SmsPricing {
  id: string;
  unit_price: number;
  packs: SmsPack[];
  effective_from: string;
}

export interface SmsOrder {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  group_id: string | null;
  pack_id: string | null;
  qty: number;
  unit_price: number;
  amount: number;
  status: "pending" | "paid" | "credited" | "failed" | "cancelled";
  djomy_ref: string | null;
  admin_note: string | null;
}

export async function getMySmsWallet(): Promise<SmsWallet | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase
    .from("sms_wallets")
    .select("user_id, balance_remaining, total_purchased, total_consumed")
    .eq("user_id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as SmsWallet | null) ?? null;
}

export async function getActiveSmsPricing(): Promise<SmsPricing | null> {
  const { data, error } = await supabase
    .from("sms_pricing")
    .select("id, unit_price, packs, effective_from")
    .eq("is_active", true)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, packs: (data.packs as unknown as SmsPack[]) ?? [] };
}

export async function listMySmsOrders(limit = 50): Promise<SmsOrder[]> {
  const { data, error } = await supabase
    .from("sms_orders")
    .select("id, created_at, updated_at, user_id, group_id, pack_id, qty, unit_price, amount, status, djomy_ref, admin_note")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SmsOrder[];
}

interface InitSmsOrderResponse {
  orderId: string;
  transactionId: string;
  redirectUrl: string;
  amount: number;
  qty: number;
}

export async function initSmsOrderCheckout(input: {
  packId: string;
  groupId?: string | null;
  payerPhone: string;
}): Promise<InitSmsOrderResponse> {
  const base =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? window.location.origin
      : ((import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(/\/$/, "") ??
        "https://tontine-digitale.lovable.app");
  const { data, error } = await supabase.functions.invoke<InitSmsOrderResponse | { error: string }>(
    "djomy-init-sms-order",
    {
      body: {
        packId: input.packId,
        groupId: input.groupId ?? null,
        payerPhone: input.payerPhone,
        returnUrl: `${base}/payment/return`,
        cancelUrl: `${base}/payment/cancel`,
      },
    },
  );
  if (error) throw new Error(error.message ?? "SMS_ORDER_INIT_FAILED");
  if (!data || "error" in data) throw new Error((data as { error?: string })?.error ?? "SMS_ORDER_INIT_FAILED");
  return data as InitSmsOrderResponse;
}