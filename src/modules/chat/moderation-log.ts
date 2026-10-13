// Colección "moderation_log": quién borró o silenció a quién, para el panel de moderación.
import type { Db } from "mongodb";
import type { LoggedAction, ModerationLogEntry } from "./types";

const log = (db: Db) => db.collection<LoggedAction>("moderation_log");

export async function logAction(db: Db, action: LoggedAction): Promise<void> {
  await log(db).insertOne(action);
}

/** Las últimas `limit` acciones, la más nueva primero */
export async function lastActions(db: Db, limit: number): Promise<ModerationLogEntry[]> {
  const actions = await log(db).find().sort({ _id: -1 }).limit(limit).toArray();
  return actions.map(({ at, mod, action, target, text, minutes, reason }) => ({
    at: at.toISOString(),
    mod,
    action,
    target,
    ...(text != null && { text }), // != null: Mongo guarda los campos undefined como null
    ...(minutes != null && { minutes }),
    ...(reason && { reason }),
  }));
}
