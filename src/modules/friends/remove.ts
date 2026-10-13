// DELETE /friends/:id: deja de ser amigo del jugador :id (para los dos).
import type { FastifyInstance } from "fastify";
import { AppError } from "../../shared/errors";
import type { ModuleDeps } from "../../shared/module";
import { respond } from "../../shared/response";
import { parseBody } from "../../shared/validation";
import { requireUser } from "../auth/require-user";
import { removeBetween } from "./friendships";
import { playerIdSchema } from "./schemas";

export function removeRoute(app: FastifyInstance, { db, config }: ModuleDeps): void {
  app.delete("/friends/:id", async (req, reply) => {
    const me = requireUser(req, config);
    const { id } = parseBody(playerIdSchema, req.params);
    if (!(await removeBetween(db, me, id, "accepted"))) {
      throw new AppError(404, "NOT_FRIENDS", "Ese jugador no es tu amigo");
    }
    return respond(reply, 200, "Amigo eliminado");
  });
}
