import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface EntitlementLimits {
  max_groups: number;
  max_members_per_group: number;
  max_solo: number;
  max_international: number;
  channels?: string[];
  international_readonly?: boolean;
  features?: string[];
}

export interface Entitlements {
  authenticated: boolean;
  plan_code: "free" | "premium" | "business";
  plan_label: string;
  base_price: number;
  sms_included: number;
  limits: EntitlementLimits;
  status: "free" | "active" | "trialing" | "past_due" | "cancelled" | "pending";
  current_period_end: string | null;
  price_monthly: number;
  tier_options: Record<string, number>;
  read_only: boolean;
  usage: { groups: number };
}

const DEFAULT_FREE: Entitlements = {
  authenticated: false,
  plan_code: "free",
  plan_label: "Free",
  base_price: 0,
  sms_included: 0,
  limits: {
    max_groups: 2,
    max_members_per_group: 5,
    max_solo: 0,
    max_international: 0,
  },
  status: "free",
  current_period_end: null,
  price_monthly: 0,
  tier_options: {},
  read_only: false,
  usage: { groups: 0 },
};

export function useEntitlements() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["entitlements", user?.id ?? "anon"],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<Entitlements> => {
      const { data, error } = await supabase.rpc("get_my_entitlements");
      if (error) throw error;
      return { ...DEFAULT_FREE, ...(data as unknown as Entitlements) };
    },
  });

  const ent = q.data ?? DEFAULT_FREE;
  const canCreateGroup = () => {
    if (ent.read_only) return { ok: false, reason: "READ_ONLY" as const };
    const max = ent.limits?.max_groups ?? 2;
    if (max === -1) return { ok: true as const };
    if (ent.usage.groups >= max) return { ok: false, reason: "QUOTA_GROUPS" as const, max, used: ent.usage.groups };
    return { ok: true as const };
  };
  const canAddMember = (currentCount: number) => {
    const max = ent.limits?.max_members_per_group ?? 5;
    if (max === -1) return { ok: true as const };
    if (currentCount >= max) return { ok: false, reason: "QUOTA_MEMBERS" as const, max };
    return { ok: true as const };
  };

  return {
    ...q,
    entitlements: ent,
    canCreateGroup,
    canAddMember,
  };
}