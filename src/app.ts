// Arma la aplicación: plugins, manejo de errores y módulos. Cada módulo recibe solo lo que necesita.
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { Db } from "mongodb";
import { nextId } from "./db/counters";
import { AppError } from "./shared/errors";
import { createTokens } from "./shared/tokens";
import { createAccountsRepository } from "./modules/accounts/accounts.repository";
import { createPlayersRepository } from "./modules/players/players.repository";
import { createAuthService } from "./modules/auth/auth.service";
import { authRoutes } from "./modules/auth/auth.routes";
import type { Config } from "./types";

export async function buildApp(db: Db, config: Config) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });
  await app.register(cors, { origin: config.corsOrigin });
  await app.register(rateLimit, { max: config.requestsPerMinute, timeWindow: "1 minute" });

  // Errores esperados (AppError) → { error: "mensaje" } con su código. El resto lo maneja Fastify
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) return reply.code(err.status).send({ error: err.message });
    return reply.send(err);
  });

  const auth = createAuthService({
    accounts: createAccountsRepository(db),
    players: createPlayersRepository(db),
    tokens: createTokens(config),
    nextUserId: () => nextId(db, "userId"),
  });
  authRoutes(app, auth);

  return app;
}
