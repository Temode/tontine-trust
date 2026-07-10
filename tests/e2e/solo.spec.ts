import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * M6 — Tontine Solo
 * Vérifie côté base :
 *  1. Un groupe Solo en mode 'project' bloque tout retrait avant solo_lock_until.
 *  2. Une fois la date passée, le retrait est autorisé.
 *  3. Un groupe Solo en mode 'working_capital' autorise le retrait immédiatement.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

test.describe("M6 — Tontine Solo", () => {
  test.skip(!SUPABASE_URL || !SERVICE_KEY, "SUPABASE_URL / SERVICE_ROLE_KEY manquants");

  test("retrait bloqué avant lock_until (project) puis débloqué", async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) User de test
    const email = `solo-m6-${Date.now()}@example.test`;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, email_confirm: true, password: "P@ssw0rd!12345",
    });
    expect(cErr).toBeNull();
    const uid = created.user!.id;

    // 2) Group Solo project avec lock 30 jours dans le futur
    const lockFuture = new Date(Date.now() + 30 * 86400_000).toISOString();
    const { data: gRow, error: gErr } = await admin.from("groups").insert({
      name: "Test Solo Project",
      contribution_amount: 50000,
      frequency: "mensuelle",
      max_members: 1,
      rotation_order_kind: "fixed",
      status: "active",
      visibility: "private",
      created_by: uid,
      kind: "solo",
      solo_mode: "project",
      solo_lock_until: lockFuture,
    }).select("id").single();
    expect(gErr).toBeNull();
    const gid = gRow!.id;

    // 3) Insert withdrawal → doit être bloqué
    const { error: wErr } = await admin.from("withdrawal_requests").insert({
      user_id: uid, group_id: gid, amount: 10000, method: "orange_money", destination: "620000000",
    });
    expect(wErr?.message ?? "").toMatch(/SOLO_LOCKED_UNTIL/);

    // 4) Fait passer lock dans le passé → doit être autorisé
    await admin.from("groups").update({ solo_lock_until: new Date(Date.now() - 86400_000).toISOString() }).eq("id", gid);
    const { error: wErr2 } = await admin.from("withdrawal_requests").insert({
      user_id: uid, group_id: gid, amount: 10000, method: "orange_money", destination: "620000000",
    });
    expect(wErr2).toBeNull();

    // 5) Groupe working_capital : retrait libre
    const { data: g2 } = await admin.from("groups").insert({
      name: "Test Solo WC", contribution_amount: 50000, frequency: "mensuelle",
      max_members: 1, rotation_order_kind: "fixed", status: "active",
      visibility: "private", created_by: uid, kind: "solo", solo_mode: "working_capital",
    }).select("id").single();
    const { error: wErr3 } = await admin.from("withdrawal_requests").insert({
      user_id: uid, group_id: g2!.id, amount: 5000, method: "orange_money", destination: "620000000",
    });
    expect(wErr3).toBeNull();

    // Cleanup
    await admin.from("withdrawal_requests").delete().eq("user_id", uid);
    await admin.from("group_members").delete().eq("user_id", uid);
    await admin.from("groups").delete().eq("created_by", uid);
    await admin.auth.admin.deleteUser(uid);
  });
});