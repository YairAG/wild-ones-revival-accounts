import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/modules/auth/password";

test("hash y verificación de contraseñas", async () => {
  const stored = await hashPassword("clave-segura");
  assert.ok(!stored.includes("clave-segura"));
  assert.notEqual(stored, await hashPassword("clave-segura")); // salt distinto cada vez
  assert.equal(await verifyPassword("clave-segura", stored), true);
  assert.equal(await verifyPassword("otra-clave", stored), false);
});
