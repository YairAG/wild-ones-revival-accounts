// Arma la aplicación: plugins, manejo de errores y módulos.
import Fastify, { type FastifyError, type FastifyReply } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import type { Db } from "mongodb";
import type { Config } from "./config/env";
import { AppError } from "./shared/errors";
import { failure, type ErrorId } from "./shared/response";
import { authModule } from "./modules/auth";
import { blocksModule } from "./modules/blocks";
import { chatModule } from "./modules/chat";
import { friendsModule } from "./modules/friends";
import { playersModule } from "./modules/players";

export async function buildApp(db: Db, config: Config) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });
  // credentials: el navegador manda y guarda la cookie de sesión (solo desde corsOrigin, nunca "*")
  await app.register(cors, {
    origin: config.corsOrigin,
    methods: ["GET", "POST", "DELETE"],
    credentials: true,
  });
  await app.register(cookie);
  // El límite de intentos se activa por ruta (solo /login y /register, contra fuerza bruta)
  await app.register(rateLimit, { global: false });
  await app.register(websocket); // para el chat

  // Todos los errores salen con el mismo formato: { ok: false, code, message, error } (ver shared/response.ts)
  const fail = (reply: FastifyReply, code: number, error: ErrorId, message: string) =>
    reply.code(code).send(failure(code, error, message));
  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof AppError) return fail(reply, err.status, err.error, err.message);
    if (err.statusCode === 429) {
      return fail(reply, 429, "TOO_MANY_REQUESTS", "Demasiados intentos, espera un minuto");
    }
    // Otros errores del cliente que detecta Fastify (p. ej. JSON mal escrito)
    if (err.statusCode && err.statusCode < 500) {
      return fail(reply, err.statusCode, "INVALID_DATA", "La petición no es válida");
    }
    req.log.error(err);
    return fail(reply, 500, "SERVER_ERROR", "Error inesperado, intenta de nuevo");
  });
  app.setNotFoundHandler((_req, reply) => fail(reply, 404, "NOT_FOUND", "Esa ruta no existe"));

  // Módulos
  authModule(app, { db, config });
  friendsModule(app, { db, config });
  playersModule(app, { db, config });
  blocksModule(app, { db, config });
  chatModule(app, { db, config });

  return app;
}
