// Para rutas que piden sesión: saca el id del jugador del JWT que manda el frontend
// (Authorization: Bearer <token>, el mismo de /login). Sin token válido responde 401 (SESSION_EXPIRED).
import type { FastifyRequest } from "fastify";
import type { Config } from "../../config/env";
import { AppError } from "../../shared/errors";
import { verifyToken } from "./token";

export function requireUser(req: FastifyRequest, config: Config): number {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  const id = token ? verifyToken(config, token) : null;
  if (id === null) throw new AppError(401, "SESSION_EXPIRED", "Tu sesión expiró, vuelve a entrar");
  return id;
}
