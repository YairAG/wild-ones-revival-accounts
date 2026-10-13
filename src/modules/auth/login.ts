// POST /login: verifica nombre y contraseña, abre la sesión (cookie) y devuelve el token de acceso.
import type { FastifyInstance } from "fastify";
import { AppError } from "../../shared/errors";
import { attemptsLimit } from "./attempts-limit";
import type { ModuleDeps } from "../../shared/module";
import { respond } from "../../shared/response";
import { parseBody } from "../../shared/validation";
import { findAccountByName } from "./accounts";
import { verifyPassword } from "./password";
import { credentialsSchema } from "./schemas";
import { startSession } from "./session-cookie";

export function loginRoute(app: FastifyInstance, { db, config }: ModuleDeps): void {
  app.post("/login", attemptsLimit(config), async (req, reply) => {
    const { dname, password } = parseBody(credentialsSchema, req.body);

    const account = await findAccountByName(db, dname);
    // Mismo error si el nombre no existe o la contraseña está mal: no revela qué nombres existen
    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      throw new AppError(401, "WRONG_CREDENTIALS", "Nombre o contraseña incorrectos");
    }

    const session = await startSession(reply, db, config, {
      id: account.userId,
      dname: account.dname,
    });
    return respond(reply, 200, "Sesión iniciada", session);
  });
}
