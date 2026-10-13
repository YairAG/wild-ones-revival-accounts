// Módulo blocks: bloquear y desbloquear jugadores. Bloquear quita la amistad y las solicitudes entre los dos, y
// mientras dure ninguno puede mandarle solicitud al otro (ni invitarlo: solo se invita a amigos). Sus mensajes
// del chat los oculta el frontend.
//   POST   /blocks/:id   bloquear al jugador :id
//   DELETE /blocks/:id   desbloquearlo
import type { FastifyInstance } from "fastify";
import { AppError } from "../../shared/errors";
import type { ModuleDeps } from "../../shared/module";
import { respond } from "../../shared/response";
import { parseBody } from "../../shared/validation";
import { findAccountById } from "../auth/accounts";
import { requireUser } from "../auth/require-user";
import { removeAnyBetween } from "../friends/friendships";
import { playerIdSchema } from "../friends/schemas";
import { addBlock, removeBlock } from "./blocks";

export function blocksModule(app: FastifyInstance, { db, config }: ModuleDeps): void {
  app.post("/blocks/:id", async (req, reply) => {
    const me = requireUser(req, config);
    const { id } = parseBody(playerIdSchema, req.params);
    if (id === me) throw new AppError(400, "SELF_BLOCK", "No puedes bloquearte a ti mismo");
    const target = await findAccountById(db, id);
    if (!target) throw new AppError(404, "PLAYER_NOT_FOUND", "Ese jugador no existe");

    await addBlock(db, me, id);
    await removeAnyBetween(db, me, id); // amistad o solicitud pendiente
    return respond(reply, 200, `Bloqueaste a ${target.dname}`);
  });

  app.delete("/blocks/:id", async (req, reply) => {
    const me = requireUser(req, config);
    const { id } = parseBody(playerIdSchema, req.params);
    if (!(await removeBlock(db, me, id))) {
      throw new AppError(404, "NOT_BLOCKED", "No tienes bloqueado a ese jugador");
    }
    const target = await findAccountById(db, id);
    return respond(reply, 200, `Desbloqueaste a ${target?.dname ?? "ese jugador"}`);
  });
}
