// Módulo dms: mensajes privados. Se envían por el WebSocket del chat ({ type: "dm" }, ver chat/index.ts); aquí
// están las rutas para leerlos (con sesión):
//   GET  /dms            tus conversaciones: con quién, el último mensaje y cuántos no has leído
//   GET  /dms/:id        los últimos mensajes con el jugador :id (y los marca como leídos)
//   POST /dms/:id/read   marcar como leídos (los que llegan con la conversación abierta)
import type { FastifyInstance } from "fastify";
import { AppError } from "../../shared/errors";
import type { ModuleDeps } from "../../shared/module";
import { respond } from "../../shared/response";
import { parseBody } from "../../shared/validation";
import { findAccountById } from "../auth/accounts";
import { requireUser } from "../auth/require-user";
import { playerIdSchema } from "../friends/schemas";
import { conversationsOf, lastDms, markRead } from "./direct-messages";

const THREAD_SIZE = 50;

export function dmsModule(app: FastifyInstance, { db, config }: ModuleDeps): void {
  app.get("/dms", async (req, reply) => {
    const me = requireUser(req, config);
    return respond(reply, 200, "Tus conversaciones", await conversationsOf(db, me));
  });

  app.get("/dms/:id", async (req, reply) => {
    const me = requireUser(req, config);
    const { id } = parseBody(playerIdSchema, req.params);
    const other = await findAccountById(db, id);
    if (!other) throw new AppError(404, "PLAYER_NOT_FOUND", "Ese jugador no existe");
    await markRead(db, id, me);
    const messages = await lastDms(db, me, id, THREAD_SIZE);
    return respond(reply, 200, `Conversación con ${other.dname}`, {
      with: { id, dname: other.dname },
      messages,
    });
  });

  app.post("/dms/:id/read", async (req, reply) => {
    const me = requireUser(req, config);
    const { id } = parseBody(playerIdSchema, req.params);
    await markRead(db, id, me);
    return respond(reply, 200, "Leídos");
  });
}
