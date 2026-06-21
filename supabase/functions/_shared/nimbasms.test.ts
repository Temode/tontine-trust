import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fmtSms, normalizeGNPhone, sendMessage } from "./nimbasms.ts";

Deno.test("fmtSms — sépare les milliers avec NBSP", () => {
  assertEquals(fmtSms(1_500_000), "1\u00A0500\u00A0000");
  assertEquals(fmtSms(500), "500");
  assertEquals(fmtSms(0), "0");
});

Deno.test("normalizeGNPhone — formats acceptés", () => {
  assertEquals(normalizeGNPhone("+224 620 90 00 01"), "224620900001");
  assertEquals(normalizeGNPhone("00224620900001"), "224620900001");
  assertEquals(normalizeGNPhone("620900001"), "224620900001");
  assertEquals(normalizeGNPhone("224620900001"), "224620900001");
});

Deno.test("normalizeGNPhone — formats rejetés", () => {
  assertEquals(normalizeGNPhone(""), null);
  assertEquals(normalizeGNPhone(null), null);
  assertEquals(normalizeGNPhone("12345"), null);
});

Deno.test("sendMessage — credentials manquants → success=false", async () => {
  const prevId = Deno.env.get("NIMBA_SERVICE_ID");
  const prevTok = Deno.env.get("NIMBA_SECRET_TOKEN");
  const prevDisabled = Deno.env.get("SMS_ENABLED");
  Deno.env.delete("NIMBA_SERVICE_ID");
  Deno.env.delete("NIMBA_SECRET_TOKEN");
  Deno.env.delete("SMS_ENABLED");

  try {
    const r = await sendMessage({ to: "224620900001", body: "hi" });
    assertEquals(r.success, false);
    assert(r.error?.includes("credentials"));
  } finally {
    if (prevId) Deno.env.set("NIMBA_SERVICE_ID", prevId);
    if (prevTok) Deno.env.set("NIMBA_SECRET_TOKEN", prevTok);
    if (prevDisabled) Deno.env.set("SMS_ENABLED", prevDisabled);
  }
});

Deno.test("sendMessage — SMS_ENABLED=false court-circuite", async () => {
  const prev = Deno.env.get("SMS_ENABLED");
  Deno.env.set("SMS_ENABLED", "false");
  try {
    const r = await sendMessage({ to: "224620900001", body: "hi" });
    assertEquals(r.success, true);
    assertEquals(r.messageId, undefined);
  } finally {
    if (prev) Deno.env.set("SMS_ENABLED", prev);
    else Deno.env.delete("SMS_ENABLED");
  }
});

Deno.test("sendMessage — 201 OK via fetch mocké", async () => {
  const realFetch = globalThis.fetch;
  Deno.env.set("NIMBA_SERVICE_ID", "svc");
  Deno.env.set("NIMBA_SECRET_TOKEN", "tok");
  Deno.env.delete("SMS_ENABLED");

  // @ts-expect-error monkey-patch pour test
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ messageid: "msg-1", message_cost: 1 }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );

  try {
    const r = await sendMessage({ to: "224620900001", body: "Bonjour" });
    assertEquals(r.success, true);
    assertEquals(r.messageId, "msg-1");
    assertEquals(r.messageCost, 1);
  } finally {
    globalThis.fetch = realFetch;
    Deno.env.delete("NIMBA_SERVICE_ID");
    Deno.env.delete("NIMBA_SECRET_TOKEN");
  }
});

Deno.test("sendMessage — 400 (erreur client) pas de retry", async () => {
  const realFetch = globalThis.fetch;
  Deno.env.set("NIMBA_SERVICE_ID", "svc");
  Deno.env.set("NIMBA_SECRET_TOKEN", "tok");
  Deno.env.delete("SMS_ENABLED");

  let calls = 0;
  // @ts-expect-error monkey-patch pour test
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ detail: "bad recipient" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const r = await sendMessage({ to: "224620900001", body: "hi" });
    assertEquals(r.success, false);
    assertEquals(calls, 1);
    assert(r.error?.includes("400"));
  } finally {
    globalThis.fetch = realFetch;
    Deno.env.delete("NIMBA_SERVICE_ID");
    Deno.env.delete("NIMBA_SECRET_TOKEN");
  }
});