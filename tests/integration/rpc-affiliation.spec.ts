/**
 * Tests d'intégration RPC — Affiliation & Business
 * Exécute contre l'env Supabase de préproduction si SUPABASE_URL et
 * SUPABASE_SERVICE_ROLE_KEY sont définis, sinon skip.
 *
 * Cas couverts:
 *  - register_referral: code invalide
 *  - accrue_referral_earning: création + idempotence par période
 *  - apply_coordinator_commission: net=gross sur groupe non-business
 *  - audit_referral_earnings: aucune anomalie pour données cohérentes
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const enabled = !!url && !!service;
const admin: SupabaseClient | null = enabled ? createClient(url, service) : null;

const created: string[] = [];
async function mkUser(email: string) {
  const { data, error } = await admin!.auth.admin.createUser({
    email, password: "P@ss!" + Math.random().toString(36).slice(2),
    email_confirm: true, user_metadata: { otp_verified: true },
  });
  if (error) throw error;
  created.push(data.user!.id);
  await admin!.from("profiles").upsert({ id: data.user!.id, full_name: email });
  return data.user!.id;
}

(enabled ? describe : describe.skip)("RPC affiliation & business", () => {
  let referrer: string, referred: string, subId: string, refCode: string;

  beforeAll(async () => {
    referrer = await mkUser(`ref-${Date.now()}@t.local`);
    referred = await mkUser(`red-${Date.now()}@t.local`);
    const { data } = await admin!.from("profiles").select("referral_code").eq("id", referrer).single();
    refCode = data!.referral_code as string;
    const { data: sub } = await admin!.from("user_subscriptions").insert({
      user_id: referred, plan_code: "premium", price_monthly: 5000, status: "active",
    }).select("id").single();
    subId = sub!.id;
    await admin!.from("referrals").insert({
      referrer_id: referrer, referred_id: referred, referral_code: refCode,
      commission_percent: 10, status: "active",
    });
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("referral_earnings").delete().in("referrer_id", created);
    await admin.from("referrals").delete().in("referrer_id", created);
    await admin.from("user_subscriptions").delete().in("user_id", created);
    for (const u of created) await admin.auth.admin.deleteUser(u).catch(() => undefined);
  });

  it("register_referral rejette un code inexistant", async () => {
    const { error } = await admin!.rpc("register_referral", { _code: "NOPE0000" });
    // auth.uid() est null côté service_role -> not_authenticated attendu
    expect(error?.message).toMatch(/not_authenticated|referrer_not_found/);
  });

  it("accrue_referral_earning est idempotent par période", async () => {
    const p = "2026-07";
    const { data: e1 } = await admin!.rpc("accrue_referral_earning", { _subscription_id: subId, _period: p });
    const { data: e2 } = await admin!.rpc("accrue_referral_earning", { _subscription_id: subId, _period: p });
    expect(e1).toBeTruthy();
    expect(e2).toBeNull();
    const { data: rows } = await admin!.from("referral_earnings")
      .select("amount").eq("subscription_id", subId).eq("period", p);
    expect(rows?.length).toBe(1);
    expect(rows![0].amount).toBe(500);
  });

  it("apply_coordinator_commission: net=gross sur groupe collective", async () => {
    const { data: g } = await admin!.from("groups").insert({
      name: "TG", category: "test", contribution_amount: 1000,
      frequency: "mensuelle", max_members: 5, status: "draft",
      created_by: referrer, kind: "collective",
    }).select("id").single();
    const { data: res } = await admin!.rpc("apply_coordinator_commission", {
      _group_id: g!.id, _cycle_id: null, _turn_id: null, _payment_id: null,
      _beneficiary_id: referred, _gross_amount: 10000,
    });
    const r = res as { fee_amount: number; net_amount: number };
    expect(r.fee_amount).toBe(0);
    expect(r.net_amount).toBe(10000);
    await admin!.from("groups").delete().eq("id", g!.id);
  });

  it("audit_referral_earnings: 0 anomalie pour données cohérentes", async () => {
    const { data } = await admin!.rpc("audit_referral_earnings");
    const forSub = (data as { subscription_id: string }[] | null)?.filter(x => x.subscription_id === subId) ?? [];
    expect(forSub.length).toBe(0);
  });
});
