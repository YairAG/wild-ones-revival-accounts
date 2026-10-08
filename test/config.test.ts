import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config/env";

test("config: valores por defecto y obligatorios", () => {
  const config = loadConfig({ MONGO_URL: "mongodb://x/emu", JWT_SECRET: "s" });
  assert.equal(config.port, 3000);
  assert.equal(config.jwtExpiresIn, "10m");
  assert.equal(config.requestsPerMinute, 10);

  assert.throws(() => loadConfig({ MONGO_URL: "mongodb://x/emu" }), /JWT_SECRET/);
  assert.throws(() => loadConfig({ JWT_SECRET: "s" }), /MONGO_URL/);
});
