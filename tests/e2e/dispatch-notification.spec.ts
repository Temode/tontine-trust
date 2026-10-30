/**
 * E2E [@dispatch] — M4 routage notifications selon plan
 *
 * Vérifie :
 *  1. Free : dispatch crée une notif In-App, aucun SMS (sms_skipped=plan_free).
 *  2. Premium + wallet > 0 + kind critique : SMS enqueue + wallet décrémenté + ledger consumption.
 *  3. Premium + wallet = 0 + kind critique : pas de SMS, mais une notif "Forfait SMS épuisé".
 *  4. Idempotence : deux dispatch produisent deux notifs distinctes (dedupe basé sur notification_id).
 */
import { test, expect } from "../../playwright-fixture";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
const SUPABASE_SR = process.env.E2E_SUPABASE_SERVICE_ROLE!;

const USER = {
  id: "dddddddd-3333-4444-8888-000000000404",
  email: "dispatch.user@test.local",
  phone: "+224620404040",
};

async function seed() {
  const admin = createClient(SUPABASE_URL, SUPABASE_SR, { auth: { persistSession: false } });
  await admin.auth.admin.deleteUser(USER.id).catch(() => undefined);
  const { error } = await admin.auth.admin.createUser({
    id: USER.id,
    email: USER.email,
    password: "Dispatch1234!",
    email_confirm: true,
    user_metadata: { full_name: "Dispatch User", otp_verified: true },
  });
  if (error) throw new Error(`seed user: ${error.message}`);
  await admin.from("profiles").update({ phone_number: USER.phone }).eq("id", USER.id);
  await admin.from("user_subscriptions").delete().eq("user_id", USER.id);
  await admin.from("sms_wallets").delete().eq("user_id", USER.id);
  await admin.from("sms_outbox").delete().like("dedupe_key", "notif:%");
  await admin.from("notifications").delete().eq("user_id", USER.id);
  return admin;
}

async function dispatch(
  admin: ReturnType<typeof createClient>,
  kind: string,
  title = "Test",
) {
  return admin.rpc("dispatch_notification", {
    _user_id: USER.id,
    _kind: kind,
    _title: title,
    _body: "body",
    _data: {},
    _group_id: null,
    _link: null,
  });
}

test.describe("@dispatch M4 notification routing", () => {
  test.skip(!SUPABASE_URL || !SUPABASE_SR, "E2E_SUPABASE_URL / _SERVICE_ROLE requis");

  test("Free : In-App uniquement, jamais de SMS", async () => {
    const admin = await seed();
    const { data, error } = await dispatch(admin, "contribution_due", "Rappel Free");
    expect(error, `rpc: ${error?.message}`).toBeNull();
    const res = data as { in_app: boolean; sms_sent: boolean; sms_skipped: string };
    expect(res.in_app).toBe(true);
    expect(res.sms_sent).toBe(false);
    expect(res.sms_skipped).toBe("plan_free");
  });

  test("Premium + wallet 3 SMS + kind critique : SMS envoyé, wallet décrémenté", async () => {
    const admin = await seed();
    await admin.from("user_subscriptions").insert({
      user_id: USER.id, plan_code: "premium",
      tier_options: {}, price_monthly: 5000, status: "active",
      current_period_end: new Date(Date.now() + 30 * 86400_000).toISOString(),
    } as never);
    await admin.from("sms_wallets").insert({
      user_id: USER.id, balance_remaining: 3, total_purchased: 3, total_consumed: 0,
    } as never);

    const { data, error } = await dispatch(admin, "contribution_due", "Rappel Premium");
    expect(error, `rpc: ${error?.message}`).toBeNull();
    const res = data as { sms_sent: boolean; sms_skipped: string | null; wallet_balance: number };
    expect(res.sms_sent).toBe(true);
    expect(res.sms_skipped).toBeNull();
    expect(res.wallet_balance).toBe(2);

    const { count: outboxCount } = await admin
      .from("sms_outbox").select("*", { count: "exact", head: true })
      .like("dedupe_key", `notif:contribution_due:%`);
    expect(outboxCount ?? 0).toBeGreaterThanOrEqual(1);

    const { data: ledger } = await admin
      .from("sms_ledger").select("delta,reason").eq("user_id", USER.id);
    const consumption = (ledger ?? []).find((r) => (r as { reason: string }).reason === "consumption");
    expect(consumption, "consumption ledger row").toBeTruthy();
    expect((consumption as { delta: number }).delta).toBe(-1);
  });

  test("Premium + wallet 0 : pas de SMS mais notif 'Forfait SMS épuisé'", async () => {
    const admin = await seed();
    await admin.from("user_subscriptions").insert({
      user_id: USER.id, plan_code: "premium",
      tier_options: {}, price_monthly: 5000, status: "active",
      current_period_end: new Date(Date.now() + 30 * 86400_000).toISOString(),
    } as never);
    await admin.from("sms_wallets").insert({
      user_id: USER.id, balance_remaining: 0, total_purchased: 0, total_consumed: 0,
    } as never);

    const { data } = await dispatch(admin, "payout_released", "Payout");
    const res = data as { sms_sent: boolean; sms_skipped: string };
    expect(res.sms_sent).toBe(false);
    expect(res.sms_skipped).toBe("wallet_empty");

    const { data: notifs } = await admin
      .from("notifications").select("kind,title,data").eq("user_id", USER.id);
    const empty = (notifs ?? []).find((n) =>
      (n as { data: { reason?: string } }).data?.reason === "sms_wallet_empty");
    expect(empty, "nudge notification").toBeTruthy();
    expect((empty as { title: string }).title).toMatch(/épuisé/i);
  });

  test("kind non-critique : pas de SMS même en Premium avec crédit", async () => {
    const admin = await seed();
    await admin.from("user_subscriptions").insert({
      user_id: USER.id, plan_code: "premium",
      tier_options: {}, price_monthly: 5000, status: "active",
      current_period_end: new Date(Date.now() + 30 * 86400_000).toISOString(),
    } as never);
    await admin.from("sms_wallets").insert({
      user_id: USER.id, balance_remaining: 10, total_purchased: 10, total_consumed: 0,
    } as never);

    const { data } = await dispatch(admin, "member_joined", "Nouveau membre");
    const res = data as { sms_sent: boolean; sms_skipped: string; wallet_balance: number };
    expect(res.sms_sent).toBe(false);
    expect(res.sms_skipped).toBe("kind_not_critical");
    expect(res.wallet_balance).toBe(10);
  });
});
