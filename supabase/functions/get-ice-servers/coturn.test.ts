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

Deno.test("Coturn credential — RFC 8489 test vector (HMAC-SHA1)", async () => {
  // Reference: known HMAC-SHA1("key","The quick brown fox jumps over the lazy dog")
  // = de7c9b85b8b78aa6bc8a7a36f70a90701c9db4d9
  const cred = await buildCoturnCredential(
    "key",
    "The quick brown fox jumps over the lazy dog",
  );
  // base64(hex de7c9b85b8b78aa6bc8a7a36f70a90701c9db4d9) = 3nybhbi3iqa8ino2ffcJcBydtNk=
  assertEquals(cred, "3nybhbi3iqa8ino2b/cJcBydtNk=");
});