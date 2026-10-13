// Arma la aplicación: plugins, manejo de errores y módulos.
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import type { Db } from "mongodb";
import type { Config } from "./config/env";
import { AppError } from "./shared/errors";
import { authModule } from "./modules/auth";
import { chatModule } from "./modules/chat";
import { friendsModule } from "./modules/friends";

export async function buildApp(db: Db, config: Config) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });
  await app.register(cors, { origin: config.corsOrigin, methods: ["GET", "POST", "DELETE"] });
  // El límite de intentos se activa por ruta (solo /login y /register, contra fuerza bruta)
  await app.register(rateLimit, { global: false });
  await app.register(websocket); // para el chat

  // Errores esperados (AppError) → { error: "mensaje" } con su código. El resto lo maneja Fastify
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
    return reply.send(err);
  });

  // Módulos
  authModule(app, { db, config });
  friendsModule(app, { db, config });
  chatModule(app, { db, config });

  return app;
}
