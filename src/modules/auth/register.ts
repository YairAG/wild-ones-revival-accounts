// POST /register: crea la cuenta y el jugador, y devuelve un token para entrar al juego.
import type { FastifyInstance } from "fastify";
import { nextId } from "../../db/counters";
import { AppError } from "../../shared/errors";
import type { ModuleDeps } from "../../shared/module";
import { parseBody } from "../../shared/validation";
import { newPlayer } from "../players/new-player";
import { createPlayer } from "../players/players";
import { createAccount } from "./accounts";
import { hashPassword } from "./password";
import { credentialsSchema } from "./schemas";
import { signToken } from "./token";
import type { Session } from "./types";

export function registerRoute(app: FastifyInstance, { db, config }: ModuleDeps): void {
  app.post("/register", async (req, reply) => {
    const { dname, password } = parseBody(credentialsSchema, req.body);

    const id = await nextId(db, "userId");
    const created = await createAccount(db, {
      userId: id,
      dname,
      passwordHash: await hashPassword(password),
      createdAt: new Date(),
    });
    if (!created) throw new AppError(409, "Ese nombre ya existe");

    await createPlayer(db, newPlayer(id, dname));
    req.log.info({ id, dname }, "Cuenta creada");

    const session: Session = { id, dname, token: signToken(config, id) };
    return reply.code(201).send(session);
  });
}
