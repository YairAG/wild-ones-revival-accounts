// Solicitudes de amistad:
//   POST   /friends/requests             { dname }  enviar (si el otro ya te había enviado una, quedan como amigos)
//   POST   /friends/requests/:id/accept             aceptar la que te envió el jugador :id
//   DELETE /friends/requests/:id                    rechazar la que te envió o cancelar la que le enviaste
import type { FastifyInstance } from "fastify";
import { AppError } from "../../shared/errors";
import type { ModuleDeps } from "../../shared/module";
import { respond } from "../../shared/response";
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
    if (!target) throw new AppError(404, "PLAYER_NOT_FOUND", "No existe un jugador con ese nombre");
    if (target.userId === me)
      throw new AppError(400, "SELF_REQUEST", "No puedes agregarte a ti mismo");

    const existing = await findBetween(db, me, target.userId);
    if (existing?.status === "accepted")
      throw new AppError(409, "ALREADY_FRIENDS", "Ya son amigos");
    if (existing?.from === me)
      throw new AppError(409, "ALREADY_REQUESTED", "Ya le enviaste una solicitud");
    if (existing) {
      // Él ya te había enviado una: enviar la tuya es aceptarla
      await acceptRequest(db, target.userId, me);
      return respond(reply, 200, `Ahora eres amigo de ${target.dname}`, { status: "accepted" });
    }

    if (!(await createRequest(db, me, target.userId))) {
      throw new AppError(409, "ALREADY_REQUESTED", "Ya hay una solicitud entre ustedes"); // la otra llegó al mismo tiempo
    }
    return respond(reply, 201, `Solicitud enviada a ${target.dname}`, { status: "pending" });
  });

  app.post("/friends/requests/:id/accept", async (req, reply) => {
    const me = requireUser(req, config);
    const { id } = parseBody(playerIdSchema, req.params);
    if (!(await acceptRequest(db, id, me))) {
      throw new AppError(404, "REQUEST_NOT_FOUND", "No tienes una solicitud de ese jugador");
    }
    return respond(reply, 200, "Solicitud aceptada", { status: "accepted" });
  });

  app.delete("/friends/requests/:id", async (req, reply) => {
    const me = requireUser(req, config);
    const { id } = parseBody(playerIdSchema, req.params);
    if (!(await removeBetween(db, me, id, "pending"))) {
      throw new AppError(404, "REQUEST_NOT_FOUND", "No hay una solicitud con ese jugador");
    }
    return respond(reply, 200, "Solicitud eliminada");
  });
}
