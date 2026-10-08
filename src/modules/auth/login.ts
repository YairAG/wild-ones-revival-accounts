// POST /login: verifica nombre y contraseña, y devuelve un token para entrar al juego.
import type { FastifyInstance } from "fastify";
import { AppError } from "../../shared/errors";
import type { ModuleDeps } from "../../shared/module";
import { parseBody } from "../../shared/validation";
import { findAccountByName } from "./accounts";
import { verifyPassword } from "./password";
import { credentialsSchema } from "./schemas";
import { signToken } from "./token";
import type { Session } from "./types";

export function loginRoute(app: FastifyInstance, { db, config }: ModuleDeps): void {
  app.post("/login", async (req) => {
    const { dname, password } = parseBody(credentialsSchema, req.body);

    const account = await findAccountByName(db, dname);
    // Mismo error si el nombre no existe o la contraseña está mal: no revela qué nombres existen
    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      throw new AppError(401, "Nombre o contraseña incorrectos");
    }

    const session: Session = {
      id: account.userId,
      dname: account.dname,
      token: signToken(config, account.userId),
    };
    return session;
  });
}
