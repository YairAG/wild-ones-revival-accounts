// Colección "reports": reportes de jugadores a otros jugadores, para los moderadores.
import { ObjectId, type Db } from "mongodb";
import type { PlayerRef } from "../chat/types";
import type { OpenReport, StoredReport } from "./types";

const reports = (db: Db) => db.collection<StoredReport>("reports");

export async function saveReport(db: Db, report: StoredReport): Promise<void> {
  await reports(db).insertOne(report);
}

/** ¿`from` ya tiene un reporte abierto contra `target`? (uno a la vez, contra el spam de reportes) */
export async function hasOpenReport(db: Db, from: number, target: number): Promise<boolean> {
  const report = await reports(db).findOne({
    "from.id": from,
    "target.id": target,
    status: "open",
  });
  return report !== null;
}

/** Los reportes abiertos, el más nuevo primero */
export async function openReports(db: Db, limit: number): Promise<OpenReport[]> {
  const open = await reports(db).find({ status: "open" }).sort({ _id: -1 }).limit(limit).toArray();
  return open.map(({ _id, from, target, reason, details, message, createdAt }) => ({
    id: String(_id),
    from,
    target,
    reason,
    ...(details && { details }),
    ...(message && { message: { text: message.text, at: message.at.toISOString() } }),
    at: createdAt.toISOString(),
  }));
}

/** Marca un reporte abierto como resuelto. Devuelve el reporte, o null si no existe o ya estaba resuelto */
export function resolveReport(db: Db, id: string, by: PlayerRef): Promise<StoredReport | null> {
  if (!ObjectId.isValid(id)) return Promise.resolve(null);
  return reports(db).findOneAndUpdate(
    { _id: new ObjectId(id), status: "open" },
    { $set: { status: "resolved", resolvedBy: by, resolvedAt: new Date() } },
  );
}
