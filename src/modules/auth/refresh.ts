// Sesión con la cookie del refresh token:
//   POST /refresh  token de acceso nuevo (y refresh token nuevo en la cookie). Lo pide el frontend al abrir la
//                  página y cuando el de acceso vence
//   POST /logout   cierra la sesión de este navegador y borra la cookie
import type { FastifyInstance } from "fastify";
import { AppError } from "../../shared/errors";
import type { ModuleDeps } from "../../shared/module";
import { respond } from "../../shared/response";
import { findAccountById } from "./accounts";
import { clearSessionCookie, readSessionCookie, setSessionCookie } from "./session-cookie";
import { deleteSession, rotateSession } from "./sessions";
import { signToken } from "./token";
import type { Session } from "./types";

export function refreshRoutes(app: FastifyInstance, { db, config }: ModuleDeps): void {
  app.post("/refresh", async (req, reply) => {
    const cookie = readSessionCookie(req);
    const rotated = cookie ? await rotateSession(db, cookie, config.refreshTokenDays) : null;
    const account = rotated && (await findAccountById(db, rotated.userId));
    if (!account) {
      clearSessionCookie(reply);
      throw new AppError(401, "SESSION_EXPIRED", "Tu sesión expiró, vuelve a entrar");
    }
    if (rotated.token) setSessionCookie(reply, config, rotated.token);

    const session: Session = {
      id: account.userId,
      dname: account.dname,
      token: signToken(config, account.userId),
    };
    return respond(reply, 200, "Sesión renovada", session);
  });

  app.post("/logout", async (req, reply) => {
    const cookie = readSessionCookie(req);
    if (cookie) await deleteSession(db, cookie);
    clearSessionCookie(reply);
    return respond(reply, 200, "Sesión cerrada");
  });
}
