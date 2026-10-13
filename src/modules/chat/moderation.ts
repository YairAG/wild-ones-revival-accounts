// Rutas del panel de moderación (solo moderadores, con el token en Authorization como las de amigos):
//   GET /chat/moderation      quién está silenciado y las últimas acciones
//   DELETE /chat/mutes/:id    quitarle el silencio a un jugador
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Db } from "mongodb";
import type { Config } from "../../config/env";
import { AppError } from "../../shared/errors";
import type { ModuleDeps } from "../../shared/module";
import { parseBody } from "../../shared/validation";
import { findAccountById, listMuted, unmuteAccount } from "../auth/accounts";
import { requireUser } from "../auth/require-user";
import { playerIdSchema } from "../friends/schemas";
import { lastActions, logAction } from "./moderation-log";
import type { ModerationSummary, PlayerRef } from "./types";

const LOG_SIZE = 50;

/** El moderador que hace la petición, o 401 / 403 */
async function requireMod(req: FastifyRequest, db: Db, config: Config): Promise<PlayerRef> {
  const account = await findAccountById(db, requireUser(req, config));
  if (account?.role !== "mod") throw new AppError(403, "Solo los moderadores pueden hacer eso");
  return { id: account.userId, dname: account.dname };
}

export function moderationRoutes(app: FastifyInstance, { db, config }: ModuleDeps): void {
  app.get("/chat/moderation", async (req) => {
    await requireMod(req, db, config);
    const summary: ModerationSummary = {
      muted: (await listMuted(db)).map((a) => ({
        id: a.userId,
        dname: a.dname,
        until: a.mutedUntil!.toISOString(),
      })),
      log: await lastActions(db, LOG_SIZE),
    };
    return summary;
  });

  app.delete("/chat/mutes/:id", async (req, reply) => {
    const mod = await requireMod(req, db, config);
    const { id } = parseBody(playerIdSchema, req.params);
    const account = await unmuteAccount(db, id);
    if (!account) throw new AppError(404, "Ese jugador no está silenciado");
    const target = { id: account.userId, dname: account.dname };
    await logAction(db, { at: new Date(), mod, action: "unmute", target });
    return reply.code(204).send();
  });
}
