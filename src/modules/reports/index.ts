// Módulo reports: un jugador reporta a otro y los moderadores lo revisan.
//   POST /reports              reportar (con sesión). El reportado nunca sabe quién fue
//   POST /reports/:id/resolve  marcar como resuelto (solo moderadores)
// Los abiertos salen en GET /chat/moderation.
import type { FastifyInstance } from "fastify";
import { AppError } from "../../shared/errors";
import type { ModuleDeps } from "../../shared/module";
import { respond } from "../../shared/response";
import { parseBody } from "../../shared/validation";
import { findAccountById } from "../auth/accounts";
import { requireUser } from "../auth/require-user";
import { findMessage } from "../chat/messages";
import { requireMod } from "../chat/moderation";
import { logAction } from "../chat/moderation-log";
import { hasOpenReport, resolveReport, saveReport } from "./reports";
import { reportIdSchema, reportSchema } from "./schemas";

export function reportsModule(app: FastifyInstance, { db, config }: ModuleDeps): void {
  app.post("/reports", async (req, reply) => {
    const me = requireUser(req, config);
    const { targetId, reason, details, messageId } = parseBody(reportSchema, req.body);
    if (targetId === me) throw new AppError(400, "SELF_REPORT", "No puedes reportarte a ti mismo");

    const [from, target] = await Promise.all([
      findAccountById(db, me),
      findAccountById(db, targetId),
    ]);
    if (!from || !target) throw new AppError(404, "PLAYER_NOT_FOUND", "Ese jugador no existe");
    if (await hasOpenReport(db, me, targetId)) {
      throw new AppError(409, "ALREADY_REPORTED", "Ya reportaste a este jugador");
    }

    // El mensaje se toma de la base (así no se puede inventar) y tiene que ser del reportado
    let message;
    if (messageId) {
      const stored = await findMessage(db, messageId);
      if (stored?.userId !== targetId) {
        throw new AppError(404, "MESSAGE_NOT_FOUND", "Ese mensaje ya no existe");
      }
      message = { id: messageId, text: stored.original ?? stored.text, at: stored.createdAt };
    }

    await saveReport(db, {
      from: { id: from.userId, dname: from.dname },
      target: { id: target.userId, dname: target.dname },
      reason,
      ...(details && { details }),
      ...(message && { message }),
      status: "open",
      createdAt: new Date(),
    });
    return respond(reply, 201, "Reporte enviado. Moderación lo revisará");
  });

  app.post("/reports/:id/resolve", async (req, reply) => {
    const mod = await requireMod(req, db, config);
    const { id } = parseBody(reportIdSchema, req.params);
    const report = await resolveReport(db, id, mod);
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND", "Ese reporte ya no está abierto");
    await logAction(db, {
      at: new Date(),
      mod,
      action: "resolve_report",
      target: report.target,
      text: report.reason,
    });
    return respond(reply, 200, "Reporte resuelto");
  });
}
