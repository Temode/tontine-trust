/**
 * Test d'intégration : provider SMS simulé.
 *
 * Vérifie que :
 *  - les templates produisent le bon contenu (montant, prénoms, dates, ref, group),
 *  - les métadonnées (userId, turnId, groupId, kind, dedupeKey) sont correctement
 *    composées pour être routées vers nimbasms.logSmsAttempt / sms_logs,
 *  - la dédup au niveau dedupeKey est strictement stable pour un même
 *    (event, contribution, recipient).
 *
 * Lancé via : deno test --allow-none supabase/functions/_shared/__tests__/
 */
import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildBeneficiaryPaymentReceivedSms,
  buildContributionConfirmedSms,
  buildTurnPaidSms,
  fmtGNF,
  firstName,
} from "../smsTemplates.ts";

const TURN_ID = "11111111-1111-1111-1111-111111111111";
const CONTRIB_ID = "22222222-2222-2222-2222-222222222222";
const PAYER_ID = "33333333-3333-3333-3333-333333333333";
const BENEF_ID = "44444444-4444-4444-4444-444444444444";
const GROUP_ID = "55555555-5555-5555-5555-555555555555";
const REF = "TD260625.1500.ABCDEF";

// ─── 1. Provider simulé ──────────────────────────────────────────────
interface SentSms {
  body: string;
  meta: {
    userId: string;
    groupId: string | null;
    turnId: string | null;
    kind: string;
    dedupeKey: string;
  };
}

/** Faux dispatcher : applique la dédup en mémoire comme le ferait `sms_outbox`. */
function makeProvider() {
  const sent: SentSms[] = [];
  const seen = new Set<string>();
  return {
    sent,
    seen,
    send(msg: SentSms): "sent" | "dedup" {
      if (seen.has(msg.meta.dedupeKey)) return "dedup";
      seen.add(msg.meta.dedupeKey);
      sent.push(msg);
      return "sent";
    },
  };
}

// ─── 2. contribution_confirmed × 5 → 1 SMS, métadonnées exactes ──────
Deno.test("contribution_confirmed: dédup stricte sur contribution_id", () => {
  const provider = makeProvider();
  const tpl = () =>
    buildContributionConfirmedSms({
      payerUserId: PAYER_ID,
      contributionId: CONTRIB_ID,
      turnId: TURN_ID,
      groupId: GROUP_ID,
      groupName: "Épargne",
      amount: 10_000,
      turnNumber: 3,
      beneficiaryFullName: "Hadja Kankou Touré",
      dueDate: "2026-06-26",
      paidCount: 1,
      totalCount: 3,
      ref: REF,
    });
  for (let i = 0; i < 5; i++) provider.send(tpl());

  assertEquals(provider.sent.length, 1, "5 enqueues identiques doivent produire 1 SMS");
  const m = provider.sent[0];
  assertEquals(m.meta.userId, PAYER_ID);
  assertEquals(m.meta.turnId, TURN_ID);
  assertEquals(m.meta.groupId, GROUP_ID);
  assertEquals(m.meta.kind, "contribution_confirmed");
  assertEquals(m.meta.dedupeKey, `contrib_confirmed:${CONTRIB_ID}`);
  assertStringIncludes(m.body, "10\u00A0000 GNF");
  assertStringIncludes(m.body, "tour #3");
  assertStringIncludes(m.body, "Hadja K."); // prénom + initiale, accents strippés
  assertStringIncludes(m.body, "26/06/2026");
  assertStringIncludes(m.body, "1/3 membres");
  assertStringIncludes(m.body, REF);
  // Pas d'accent dans le body (compat SMS GSM-7)
  assertEquals(/[éèêàùôîÉÈÀ]/u.test(m.body), false);
});

Deno.test("contribution_confirmed: contributions différentes = SMS distincts", () => {
  const provider = makeProvider();
  const make = (cid: string) =>
    buildContributionConfirmedSms({
      payerUserId: PAYER_ID,
      contributionId: cid,
      turnId: TURN_ID,
      groupId: GROUP_ID,
      groupName: "Épargne",
      amount: 5_000,
      turnNumber: 1,
      beneficiaryFullName: "B.",
      dueDate: "2026-06-26",
      paidCount: 0,
      totalCount: 3,
      ref: REF,
    });
  provider.send(make("aaaa-1"));
  provider.send(make("aaaa-2"));
  provider.send(make("aaaa-1")); // doublon
  assertEquals(provider.sent.length, 2);
});

// ─── 3. turn_paid × 3 → 1 SMS, recipient = bénéficiaire ──────────────
Deno.test("turn_paid: dédup par turn_id + métadonnées bénéficiaire", () => {
  const provider = makeProvider();
  const tpl = () =>
    buildTurnPaidSms({
      beneficiaryUserId: BENEF_ID,
      turnId: TURN_ID,
      groupId: GROUP_ID,
      groupName: "Épargne",
      turnNumber: 3,
      amount: 30_000,
      ref: REF,
    });
  for (let i = 0; i < 3; i++) provider.send(tpl());

  assertEquals(provider.sent.length, 1);
  const m = provider.sent[0];
  assertEquals(m.meta.userId, BENEF_ID);
  assertEquals(m.meta.kind, "payout_released");
  assertEquals(m.meta.dedupeKey, `turn_paid:${TURN_ID}`);
  assertStringIncludes(m.body, "30\u00A0000 GNF");
  assertStringIncludes(m.body, "tour #3");
});

// ─── 4. beneficiary_payment_received : bénéficiaire informé ──────────
Deno.test("beneficiary_payment_received: contenu + prochaine échéance + dédup", () => {
  const provider = makeProvider();
  const tpl = (nextDue: string | null) =>
    buildBeneficiaryPaymentReceivedSms({
      beneficiaryUserId: BENEF_ID,
      beneficiaryFullName: "Hadja Kankou Touré",
      payerFullName: "Elhadj Mamadou Oury",
      contributionId: CONTRIB_ID,
      turnId: TURN_ID,
      groupId: GROUP_ID,
      groupName: "Épargne",
      amount: 10_000,
      turnNumber: 3,
      nextDueDate: nextDue,
      ref: REF,
    });

  // 4 enqueues : 3 identiques + 1 même contrib autre nextDue (doit aussi dédup).
  provider.send(tpl("2026-07-10"));
  provider.send(tpl("2026-07-10"));
  provider.send(tpl("2026-07-10"));
  provider.send(tpl("2026-07-15"));

  assertEquals(
    provider.sent.length,
    1,
    "dedup doit ignorer tout doublon (contribution_id + beneficiary)",
  );
  const m = provider.sent[0];
  assertEquals(m.meta.userId, BENEF_ID);
  assertEquals(m.meta.turnId, TURN_ID);
  assertEquals(m.meta.groupId, GROUP_ID);
  assertEquals(m.meta.kind, "beneficiary_payment_received");
  assertEquals(m.meta.dedupeKey, `bnpr:${CONTRIB_ID}:${BENEF_ID}`);
  assertStringIncludes(m.body, "Hadja"); // prénom bénéficiaire
  assertStringIncludes(m.body, "Elhadj"); // prénom payeur
  assertStringIncludes(m.body, "10\u00A0000 GNF");
  assertStringIncludes(m.body, "tour #3");
  assertStringIncludes(m.body, "10/07/2026"); // prochaine échéance
});

Deno.test("beneficiary_payment_received: nextDue manquant → message replié", () => {
  const m = buildBeneficiaryPaymentReceivedSms({
    beneficiaryUserId: BENEF_ID,
    beneficiaryFullName: "B.",
    payerFullName: "P.",
    contributionId: CONTRIB_ID,
    turnId: TURN_ID,
    groupId: GROUP_ID,
    groupName: "G",
    amount: 5_000,
    turnNumber: 1,
    nextDueDate: null,
    ref: REF,
  });
  assertStringIncludes(m.body, "notifie de votre prochaine cotisation");
});

// ─── 5. Utilitaires ──────────────────────────────────────────────────
Deno.test("fmtGNF arrondit et insère un espace insécable", () => {
  assertEquals(fmtGNF(1234567), "1\u00A0234\u00A0567 GNF");
  assertEquals(fmtGNF(null), "0 GNF");
  assertEquals(fmtGNF("999.6"), "1\u00A0000 GNF");
});

Deno.test("firstName retourne prénom + initiale sans accents", () => {
  assertEquals(firstName("Hadja Kankou Touré"), "Hadja K.");
  assertEquals(firstName("Élodie"), "Elodie");
  assertEquals(firstName(null), "Un membre");
});