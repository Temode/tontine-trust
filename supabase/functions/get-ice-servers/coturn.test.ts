import { assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildCoturnCredential } from "./index.ts";

Deno.test("Coturn credential — HMAC-SHA1 base64 length = 28", async () => {
  const expiry = 1_700_000_000 + 3600;
  const username = `${expiry}:user-abc`;
  const cred = await buildCoturnCredential("shared-secret", username);
  assertEquals(cred.length, 28);
  assertMatch(cred, /^[A-Za-z0-9+/]{27}=$/);
});

Deno.test("Coturn credential — déterministe pour un même username+secret", async () => {
  const a = await buildCoturnCredential("s", "1700000000:x");
  const b = await buildCoturnCredential("s", "1700000000:x");
  assertEquals(a, b);
});

Deno.test("Coturn credential — RFC 2202 test vector (HMAC-SHA1)", async () => {
  // HMAC-SHA1("Jefe", "what do ya want for nothing?")
  // = effcdf6ae5eb2fa2d27416d5f184df9c259a7c79
  // base64 = 7/zfauXrL6LSdBbV8YTfnCWafHk=
  const cred = await buildCoturnCredential("Jefe", "what do ya want for nothing?");
  assertEquals(cred, "7/zfauXrL6LSdBbV8YTfnCWafHk=");
});