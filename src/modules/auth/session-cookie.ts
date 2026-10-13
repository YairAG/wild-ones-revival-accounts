// Cookie con el refresh token. httpOnly: el JavaScript de la página no la puede leer (un script inyectado no se
// la roba). SameSite=Strict: el navegador no la manda desde otros sitios (protege /refresh y /logout de CSRF).
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "mongodb";
import type { Config } from "../../config/env";
import { signToken } from "./token";
import { createSession } from "./sessions";
import type { Session } from "./types";

export const SESSION_COOKIE = "wr_refresh";

export const readSessionCookie = (req: FastifyRequest): string | undefined =>
  req.cookies[SESSION_COOKIE];

export function setSessionCookie(reply: FastifyReply, config: Config, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.cookieSecure,
    path: "/",
    maxAge: config.refreshTokenDays * 24 * 60 * 60, // segundos
  });
}

export const clearSessionCookie = (reply: FastifyReply): void => {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
};

/** Al entrar o registrarse: abre la sesión (cookie) y devuelve el token de acceso */
export async function startSession(
  reply: FastifyReply,
  db: Db,
  config: Config,
  player: { id: number; dname: string },
): Promise<Session> {
  setSessionCookie(reply, config, await createSession(db, player.id, config.refreshTokenDays));
  return { ...player, token: signToken(config, player.id) };
}
