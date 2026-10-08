// Capa HTTP de autenticación: valida el body, llama al servicio y responde.
import type { FastifyInstance } from "fastify";
import { parseBody } from "../../shared/validation";
import { credentialsSchema } from "./auth.schemas";
import type { AuthService } from "./auth.service";

export function authRoutes(app: FastifyInstance, auth: AuthService): void {
  app.post("/register", async (req, reply) => {
    const session = await auth.register(parseBody(credentialsSchema, req.body));
    req.log.info({ id: session.id, dname: session.dname }, "Cuenta creada");
    return reply.code(201).send(session);
  });

  app.post("/login", async (req) => auth.login(parseBody(credentialsSchema, req.body)));
}
