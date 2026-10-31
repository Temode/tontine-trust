import { assertEquals } from "jsr:@std/assert";
import { signCallToken, verifyCallToken } from "./callToken.ts";

const S = "secret-de-test-assez-long-pour-hmac";
const CALL = "1c3fe17d-f229-4559-8313-83297d4aafa5";
const USER = "0c13a1c7-abdd-4d91-9a98-368669cfa930";

Deno.test("un jeton valide rend l'appel et le membre", async () => {
  const t = await signCallToken(S, CALL, USER);
  assertEquals(await verifyCallToken(S, t), { callId: CALL, userId: USER });
});

Deno.test("un jeton expiré après 90 s est refusé", async () => {
  const t0 = Date.now();
  const t = await signCallToken(S, CALL, USER, t0);
  assertEquals(await verifyCallToken(S, t, t0 + 89_000) !== null, true);
  assertEquals(await verifyCallToken(S, t, t0 + 92_000), null);
});

Deno.test("un jeton modifié ou signé avec une autre clé est refusé", async () => {
  const t = await signCallToken(S, CALL, USER);
  assertEquals(await verifyCallToken("autre-cle", t), null);
  const [body, sig] = t.split(".");
  assertEquals(await verifyCallToken(S, body.slice(0, -2) + "AA." + sig), null);
});
