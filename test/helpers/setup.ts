// Entorno de test: Mongo temporal + la app real (sin abrir puerto: se usa app.inject).
import { MongoMemoryServer } from "mongodb-memory-server";
import { buildApp } from "../../src/app";
import { connectMongo } from "../../src/db/mongo";
import type { Config } from "../../src/config/env";

process.env.LOG_LEVEL = "silent"; // sin logs del servidor en la salida de los tests

export const testConfig: Config = {
  port: 0,
  mongoUrl: "",
  jwtSecret: "secreto-de-test",
  jwtExpiresIn: "15m",
  refreshTokenDays: 30,
  cookieSecure: false,
  corsOrigin: "*",
  requestsPerMinute: 1000,
};

export async function startTestApp(overrides: Partial<Config> = {}) {
  const mongod = await MongoMemoryServer.create({
    binary: { version: process.env.MONGO_VERSION || "9.0.2" },
  });
  const { client, db } = await connectMongo(mongod.getUri("emu"));
  const app = await buildApp(db, { ...testConfig, ...overrides });

  return {
    app,
    db,
    post: (url: string, body: object) => app.inject({ method: "POST", url, payload: body }),
    // Petición con sesión: el token va en Authorization como lo manda el frontend
    call: (method: "GET" | "POST" | "DELETE", url: string, token?: string, body?: object) =>
      app.inject({
        method,
        url,
        payload: body,
        headers: token ? { authorization: `Bearer ${token}` } : {},
      }),
    async stop() {
      await app.close();
      await client.close();
      await mongod.stop();
    },
  };
}

export type TestApp = Awaited<ReturnType<typeof startTestApp>>;
