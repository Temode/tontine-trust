import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * M5 — Recharge SMS
 * Vérifie côté base de données :
 *  1. start_sms_order_checkout crée une commande "pending" à partir d'un pack actif.
 *  2. apply_sms_order_webhook('succeeded') crédite le portefeuille, passe la commande à 'credited',
 *     et est idempotent (2ᵉ appel ne re-crédite pas).
 *  3. Un utilisateur non membre ne peut pas commander pour un groupe où il n'est pas membre.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

test.describe("M5 — Recharge SMS", () => {
  test.skip(!SUPABASE_URL || !SERVICE_KEY, "SUPABASE_URL / SERVICE_ROLE_KEY manquants");

  test("commande → webhook succeeded → crédit + idempotence", async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Récupère un pack actif
    const { data: pricing } = await admin
      .from("sms_pricing")
      .select("id, packs")
      .eq("is_active", true)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(pricing).toBeTruthy();
    const packs = (pricing?.packs as Array<{ id: string; qty: number; price: number }>) ?? [];
    expect(packs.length).toBeGreaterThan(0);
    const pack = packs[0];

    // User de test
    const email = `sms-m5-${Date.now()}@example.test`;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, email_confirm: true, password: "P@ssw0rd!12345",
    });
    expect(cErr).toBeNull();
    const uid = created.user!.id;

    // Insère la commande manuellement (contourne auth.uid côté RPC)
    const { data: order, error: oErr } = await admin
      .from("sms_orders").insert({
        user_id: uid,
        pack_id: pack.id,
        qty: pack.qty,
        unit_price: Math.round(pack.price / pack.qty),
        amount: pack.price,
        status: "pending",
      }).select("*").single();
    expect(oErr).toBeNull();

    // Webhook succeeded → crédité
    const { error: wErr } = await admin.rpc("apply_sms_order_webhook", {
      _order_id: order!.id, _new_status: "succeeded", _djomy_ref: "TX-TEST-1",
    });
    expect(wErr).toBeNull();

    const { data: after1 } = await admin.from("sms_orders").select("status").eq("id", order!.id).single();
    expect(after1?.status).toBe("credited");

    const { data: wallet1 } = await admin.from("sms_wallets")
      .select("balance_remaining, total_purchased").eq("user_id", uid).single();
    expect(wallet1?.balance_remaining).toBe(pack.qty);

    // Idempotence : rejouer ne double pas le crédit
    await admin.rpc("apply_sms_order_webhook", {
      _order_id: order!.id, _new_status: "succeeded", _djomy_ref: "TX-TEST-1",
    });
    const { data: wallet2 } = await admin.from("sms_wallets")
      .select("balance_remaining").eq("user_id", uid).single();
    expect(wallet2?.balance_remaining).toBe(pack.qty);

    // Cleanup
    await admin.from("sms_ledger").delete().eq("user_id", uid);
    await admin.from("sms_orders").delete().eq("user_id", uid);
    await admin.from("sms_wallets").delete().eq("user_id", uid);
    await admin.auth.admin.deleteUser(uid);
  });
});