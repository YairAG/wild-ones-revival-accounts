// POST /register: crea la cuenta y el jugador, abre la sesión (cookie) y devuelve el token de acceso.
// GET /register/available: si un nombre está libre.
import type { FastifyInstance } from "fastify";
import { nextId } from "../../db/counters";
import { AppError } from "../../shared/errors";
import { attemptsLimit } from "./attempts-limit";
import type { ModuleDeps } from "../../shared/module";
import { respond } from "../../shared/response";
import { parseBody } from "../../shared/validation";
import { newPlayer } from "../players/new-player";
import { createPlayer } from "../players/players";
import { createAccount, findAccountByName } from "./accounts";
import { hashPassword } from "./password";
import { credentialsSchema, registerSchema } from "./schemas";
import { startSession } from "./session-cookie";

export function registerRoute(app: FastifyInstance, { db, config }: ModuleDeps): void {
  app.post("/register", attemptsLimit(config), async (req, reply) => {
    const { dname, password, email } = parseBody(registerSchema, req.body);

    const id = await nextId(db, "userId");
    const now = new Date();
    const created = await createAccount(db, {
      userId: id,
      dname,
      passwordHash: await hashPassword(password),
      createdAt: now,
      email,
      termsAcceptedAt: now,
    });
    if (!created) throw new AppError(409, "NAME_TAKEN", "Ese nombre ya existe");

    await createPlayer(db, newPlayer(id, dname));
    req.log.info({ id, dname }, "Cuenta creada");

    return respond(
      reply,
      201,
      "Cuenta creada",
      await startSession(reply, db, config, { id, dname }),
    );
  });

  // GET /register/available?dname=Ana: el formulario lo pregunta mientras escribes. Mismas reglas que el
  // registro (formato y sin importar mayúsculas)
  app.get("/register/available", async (req, reply) => {
    const { dname } = parseBody(credentialsSchema.pick({ dname: true }), req.query);
    const available = !(await findAccountByName(db, dname));
    return respond(reply, 200, available ? "Nombre disponible" : "Ese nombre ya existe", {
      available,
    });
  });
}
