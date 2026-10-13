// Tu cuenta (con sesión). Las que piden contraseña tienen el límite de intentos, como el login:
//   GET    /account               tus ajustes de la cuenta: { dname, dmPolicy }
//   POST   /account/privacy       quién puede escribirte en privado { dmPolicy: "friends" | "everyone" | "nobody" }
//   POST   /account/password      cambiar contraseña { current, next }; cierra tus otras sesiones
//   POST   /account/logout-others cerrar sesión en los demás navegadores (este sigue)
//   DELETE /account               eliminar la cuenta { password }: borra todo lo del jugador
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Db } from "mongodb";
import { AppError } from "../../shared/errors";
import type { ModuleDeps } from "../../shared/module";
import { respond } from "../../shared/response";
import { parseBody } from "../../shared/validation";
import { removeAllBlocksFor } from "../blocks/blocks";
import { deleteMessagesBy } from "../chat/messages";
import { deleteDmsOf } from "../dms/direct-messages";
import { removeAllFor } from "../friends/friendships";
import { deletePlayer } from "../players/players";
import { deleteAccount, findAccountById, setDmPolicy, setPasswordHash } from "./accounts";
import { attemptsLimit } from "./attempts-limit";
import { hashPassword, verifyPassword } from "./password";
import { requireUser } from "./require-user";
import { changePasswordSchema, deleteAccountSchema, privacySchema } from "./schemas";
import { clearSessionCookie, readSessionCookie } from "./session-cookie";
import { deleteOtherSessions } from "./sessions";
import type { Account } from "./types";

/** Tu cuenta, si la contraseña es la tuya; si no, 403 */
async function confirmPassword(db: Db, userId: number, password: string): Promise<Account> {
  const account = await findAccountById(db, userId);
  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    throw new AppError(403, "WRONG_PASSWORD", "La contraseña no es correcta");
  }
  return account;
}

const thisBrowser = (req: FastifyRequest) => readSessionCookie(req);

export function accountRoutes(app: FastifyInstance, { db, config }: ModuleDeps): void {
  app.get("/account", async (req, reply) => {
    const account = await findAccountById(db, requireUser(req, config));
    if (!account) throw new AppError(401, "SESSION_EXPIRED", "Tu sesión expiró, vuelve a entrar");
    return respond(reply, 200, "Tu cuenta", {
      dname: account.dname,
      dmPolicy: account.dmPolicy ?? "friends",
    });
  });

  app.post("/account/privacy", async (req, reply) => {
    const me = requireUser(req, config);
    const { dmPolicy } = parseBody(privacySchema, req.body);
    await setDmPolicy(db, me, dmPolicy);
    return respond(reply, 200, "Ajuste guardado");
  });

  app.post("/account/password", attemptsLimit(config), async (req, reply) => {
    const me = requireUser(req, config);
    const { current, next } = parseBody(changePasswordSchema, req.body);
    await confirmPassword(db, me, current);
    await setPasswordHash(db, me, await hashPassword(next));
    // Si alguien más tenía tu sesión abierta, ya no
    await deleteOtherSessions(db, me, thisBrowser(req));
    return respond(reply, 200, "Contraseña cambiada. Se cerraron tus otras sesiones");
  });

  app.post("/account/logout-others", async (req, reply) => {
    const me = requireUser(req, config);
    const closed = await deleteOtherSessions(db, me, thisBrowser(req));
    return respond(
      reply,
      200,
      closed === 0
        ? "No había otras sesiones"
        : `Se ${closed === 1 ? "cerró 1 sesión" : `cerraron ${closed} sesiones`}`,
    );
  });

  app.delete("/account", attemptsLimit(config), async (req, reply) => {
    const me = requireUser(req, config);
    const { password } = parseBody(deleteAccountSchema, req.body);
    const account = await confirmPassword(db, me, password);

    // Todo lo del jugador. Los reportes y el registro de moderación se quedan (son de moderación)
    await Promise.all([
      removeAllFor(db, me),
      removeAllBlocksFor(db, me),
      deleteMessagesBy(db, me),
      deleteDmsOf(db, me),
      deletePlayer(db, me),
      deleteOtherSessions(db, me), // todas, también la de este navegador
    ]);
    await deleteAccount(db, me);
    clearSessionCookie(reply);
    req.log.info({ id: me, dname: account.dname }, "Cuenta eliminada");
    return respond(reply, 200, "Cuenta eliminada");
  });
}
