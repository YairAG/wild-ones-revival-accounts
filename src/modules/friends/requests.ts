// Solicitudes de amistad:
//   POST   /friends/requests             { dname }  enviar (si el otro ya te había enviado una, quedan como amigos)
//   POST   /friends/requests/:id/accept             aceptar la que te envió el jugador :id
//   DELETE /friends/requests/:id                    rechazar la que te envió o cancelar la que le enviaste
import type { FastifyInstance } from "fastify";
import { AppError } from "../../shared/errors";
import type { ModuleDeps } from "../../shared/module";
import { parseBody } from "../../shared/validation";
import { findAccountByName } from "../auth/accounts";
import { requireUser } from "../auth/require-user";
import { acceptRequest, createRequest, findBetween, removeBetween } from "./friendships";
import { friendRequestSchema, playerIdSchema } from "./schemas";

export function requestsRoutes(app: FastifyInstance, { db, config }: ModuleDeps): void {
  app.post("/friends/requests", async (req, reply) => {
    const me = requireUser(req, config);
    const { dname } = parseBody(friendRequestSchema, req.body);

    const target = await findAccountByName(db, dname);
    if (!target) throw new AppError(404, "No existe un jugador con ese nombre");
    if (target.userId === me) throw new AppError(400, "No puedes agregarte a ti mismo");

    const existing = await findBetween(db, me, target.userId);
    if (existing?.status === "accepted") throw new AppError(409, "Ya son amigos");
    if (existing?.from === me) throw new AppError(409, "Ya le enviaste una solicitud");
    if (existing) {
      // Él ya te había enviado una: enviar la tuya es aceptarla
      await acceptRequest(db, target.userId, me);
      return { status: "accepted" };
    }

    if (!(await createRequest(db, me, target.userId))) {
      throw new AppError(409, "Ya hay una solicitud entre ustedes"); // la otra llegó al mismo tiempo
    }
    return reply.code(201).send({ status: "pending" });
  });

  app.post("/friends/requests/:id/accept", async (req) => {
    const me = requireUser(req, config);
    const { id } = parseBody(playerIdSchema, req.params);
    if (!(await acceptRequest(db, id, me))) {
      throw new AppError(404, "No tienes una solicitud de ese jugador");
    }
    return { status: "accepted" };
  });

  app.delete("/friends/requests/:id", async (req, reply) => {
    const me = requireUser(req, config);
    const { id } = parseBody(playerIdSchema, req.params);
    if (!(await removeBetween(db, me, id, "pending"))) {
      throw new AppError(404, "No hay una solicitud con ese jugador");
    }
    return reply.code(204).send();
  });
}
