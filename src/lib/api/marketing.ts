import { supabase } from "@/integrations/supabase/client";

export interface CampaignContent { subject: string | null; body: string }
export interface CampaignStats {
  sent: number; sms: number; email: number; clicks: number; conversions: number; cost: number;
}
export interface MarketingCampaign {
  id: string;
  code: string;
  label: string;
  description: string | null;
  segment: string;
  trigger_delay_days: number;
  repeat_days: number;
  sms_enabled: boolean;
  email_enabled: boolean;
  per_user_cap: number;
  cap_period_days: number;
  priority: number;
  is_active: boolean;
  contents: Partial<Record<"sms" | "email", CampaignContent>>;
  stats: CampaignStats;
}
export interface MarketingSettings {
  global_enabled: boolean;
  sms_unit_cost_gnf: number;
  daily_budget_gnf: number;
  monthly_budget_gnf: number;
  quiet_start_hour: number;
  quiet_end_hour: number;
  max_sms_per_user_30d: number;
  spent_today: number;
  spent_month: number;
}
export interface MarketingSend {
  id: string;
  campaign_code: string;
  channel: "sms" | "email";
  user_id: string;
  full_name: string | null;
  status: string;
  cost_gnf: number;
  body: string | null;
  clicked_at: string | null;
  converted_at: string | null;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args);

export async function listCampaigns(): Promise<MarketingCampaign[]> {
  const { data, error } = await rpc("admin_list_marketing_campaigns");
  if (error) throw new Error(error.message);
  return (data ?? []) as MarketingCampaign[];
}

export async function saveCampaign(payload: Partial<MarketingCampaign> & { code: string }) {
  const rest: Record<string, unknown> = { ...payload };
  delete rest.contents; delete rest.stats; delete rest.id;
  const { error } = await rpc("admin_upsert_marketing_campaign", { _payload: rest });
  if (error) throw new Error(error.message);
}

export async function saveCampaignContent(
  code: string, channel: "sms" | "email", subject: string | null, body: string,
) {
  const { error } = await rpc("admin_upsert_marketing_content", {
    _code: code, _channel: channel, _subject: subject, _body: body,
  });
  if (error) throw new Error(error.message);
}

export async function getMarketingSettings(): Promise<MarketingSettings> {
  const { data, error } = await rpc("admin_marketing_settings");
  if (error) throw new Error(error.message);
  return data as MarketingSettings;
}

export async function updateMarketingSettings(payload: Partial<MarketingSettings>) {
  const { error } = await rpc("admin_update_marketing_settings", { _payload: payload });
  if (error) throw new Error(error.message);
}

export async function listSends(
  campaign?: string | null, channel?: string | null, limit = 100,
): Promise<MarketingSend[]> {
  const { data, error } = await rpc("admin_list_marketing_sends", {
    _campaign: campaign ?? null, _channel: channel ?? null, _limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as MarketingSend[];
}
