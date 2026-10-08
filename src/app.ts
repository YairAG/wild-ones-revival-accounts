// Arma la aplicación: plugins, manejo de errores y módulos.
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { Db } from "mongodb";
import type { Config } from "./config/env";
import { AppError } from "./shared/errors";
import { authModule } from "./modules/auth";

export async function buildApp(db: Db, config: Config) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });
  await app.register(cors, { origin: config.corsOrigin });
  await app.register(rateLimit, { max: config.requestsPerMinute, timeWindow: "1 minute" });

  // Errores esperados (AppError) → { error: "mensaje" } con su código. El resto lo maneja Fastify
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
    return reply.send(err);
  });

  // Módulos
  authModule(app, { db, config });

  return app;
}
