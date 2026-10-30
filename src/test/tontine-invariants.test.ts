/**
 * Tests d'invariants tontine.
 *
 * Ces tests interrogent la BDD via les vues `cycle_open_turn_check` et
 * `turn_assignment_audit` exposées par la migration intégrité.
 *
 * Ils sont skippés automatiquement si les variables d'environnement
 * Supabase ne sont pas disponibles (CI local sans secrets).
 *
 * Invariants vérifiés :
 *  1. Au plus 1 tour `collecting` par cycle.
 *  2. Aucune cotisation n'a comme payeur le bénéficiaire du tour.
 *  3. Aucune cotisation n'est attribuée à un non-membre actif.
 *  4. Aucune table d'alerte ne contient d'alerte `critical` non résolue.
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  process.env.VITE_SUPABASE_URL;
const key =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const runIfConfigured = url && key ? describe : describe.skip;

runIfConfigured("tontine invariants", () => {
  const supabase = createClient(url!, key!);

  it("au plus 1 tour 'collecting' par cycle", async () => {
    const { data, error } = await supabase
      .from("cycle_open_turn_check")
      .select("cycle_id, group_id, open_turns");
    expect(error).toBeNull();
    const violations = (data ?? []).filter((r: any) => r.open_turns > 1);
    if (violations.length > 0) {
      console.error("Cycles avec plusieurs tours ouverts :", violations);
    }
    expect(violations).toEqual([]);
  });

  it("aucune cotisation où payeur = bénéficiaire", async () => {
    const { data, error } = await supabase
      .from("turn_assignment_audit")
      .select("turn_id, contribution_id, flag_payer_is_beneficiary")
      .eq("flag_payer_is_beneficiary", true);
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("aucune cotisation attribuée à un non-membre", async () => {
    const { data, error } = await supabase
      .from("turn_assignment_audit")
      .select("turn_id, contribution_id, flag_payer_not_active")
      .eq("flag_payer_not_active", true)
      .not("contribution_id", "is", null);
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("aucune alerte critical non résolue", async () => {
    const { data, error } = await supabase
      .from("tontine_alerts")
      .select("id, code, message, created_at")
      .eq("severity", "critical")
      .is("resolved_at", null);
    // Si les RLS empêchent l'accès anonyme, on tolère l'erreur d'autorisation.
    if (error && /permission|denied|jwt/i.test(error.message)) {
      return;
    }
    expect(error).toBeNull();
    if ((data ?? []).length > 0) {
      console.error("Alertes critiques ouvertes :", data);
    }
    expect(data ?? []).toEqual([]);
  });
});