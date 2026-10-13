// Colección "chat_messages": el historial del chat global.
import { ObjectId, type Db } from "mongodb";
import type { ChatMessage, StoredMessage } from "./types";

const messages = (db: Db) => db.collection<StoredMessage>("chat_messages");

export function toChatMessage({ _id, userId, dname, text, createdAt }: StoredMessage): ChatMessage {
  return { id: String(_id), userId, dname, text, at: createdAt.toISOString() };
}

/** Guarda el mensaje y lo devuelve como lo ve el frontend */
export async function saveMessage(db: Db, message: StoredMessage): Promise<ChatMessage> {
  const { insertedId } = await messages(db).insertOne(message);
  return toChatMessage({ ...message, _id: insertedId });
}

/** Borra un mensaje por su id. Devuelve false si no existe */
export async function deleteMessage(db: Db, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const { deletedCount } = await messages(db).deleteOne({ _id: new ObjectId(id) });
  return deletedCount === 1;
}

/** Los últimos `limit` mensajes, del más viejo al más nuevo */
export async function lastMessages(db: Db, limit: number): Promise<ChatMessage[]> {
  const newest = await messages(db).find().sort({ _id: -1 }).limit(limit).toArray();
  return newest.reverse().map(toChatMessage);
}
