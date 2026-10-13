import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config/env";

test("config: valores por defecto y obligatorios", () => {
  const config = loadConfig({ MONGO_URL: "mongodb://x/emu", JWT_SECRET: "s" });
  assert.equal(config.port, 3000);
  assert.equal(config.jwtExpiresIn, "15m");
  assert.equal(config.refreshTokenDays, 30);
  assert.equal(config.cookieSecure, false);
  assert.equal(
    loadConfig({ MONGO_URL: "m", JWT_SECRET: "s", COOKIE_SECURE: "true" }).cookieSecure,
    true,
  );
  assert.equal(config.requestsPerMinute, 10);

  assert.throws(() => loadConfig({ MONGO_URL: "mongodb://x/emu" }), /JWT_SECRET/);
  assert.throws(() => loadConfig({ JWT_SECRET: "s" }), /MONGO_URL/);
});
