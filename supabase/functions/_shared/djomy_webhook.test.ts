import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractDjomyWebhookSignature,
  getDjomyWebhookContext,
  hmacSha256Hex,
  mapDjomyEventStatus,
} from "./djomy.ts";

Deno.test("Djomy webhook — extrait les signatures v1: et v1=", () => {
  assertEquals(extractDjomyWebhookSignature("v1:ABCDEF1234"), "abcdef1234");
  assertEquals(extractDjomyWebhookSignature("t=123,v1=ABCDEF1234"), "abcdef1234");
  assertEquals(extractDjomyWebhookSignature("sha256=ABCDEF1234"), "abcdef1234");
});

Deno.test("Djomy webhook — mappe les statuts abonnement", () => {
  assertEquals(mapDjomyEventStatus("payment.success"), "succeeded");
  assertEquals(mapDjomyEventStatus("payment.pending"), "pending");
  assertEquals(mapDjomyEventStatus("payment.failed"), "failed");
  assertEquals(mapDjomyEventStatus("unknown"), null);
});

Deno.test("Djomy webhook — lit le metadata abonnement au niveau racine", () => {
  const payload = {
    eventId: "10f54b61-1ad7-47b6-833f-5e3623256600",
    eventType: "payment.success",
    data: {
      transactionId: "13c3720c-24b7-4cb0-b8e9-9598960e1f36",
      merchantPaymentReference: "b3cec2f8-1b5c-4e3d-b806-b0ba1c278542",
      status: "SUCCESS",
    },
    metadata: {
      purpose: "subscription",
      subscription_id: "b3cec2f8-1b5c-4e3d-b806-b0ba1c278542",
      plan_code: "premium",
    },
  };

  const ctx = getDjomyWebhookContext(payload);
  assertEquals(ctx.purpose, "subscription");
  assertEquals(ctx.newStatus, "succeeded");
  assertEquals(ctx.transactionId, "13c3720c-24b7-4cb0-b8e9-9598960e1f36");
  assertEquals(ctx.merchantRef, "b3cec2f8-1b5c-4e3d-b806-b0ba1c278542");
});

Deno.test("Djomy webhook — HMAC du payload brut avec clientSecret", async () => {
  const raw = JSON.stringify({ eventType: "payment.success" });
  const sig = await hmacSha256Hex("secret", raw);
  assertEquals(sig.length, 64);
});