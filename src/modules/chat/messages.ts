// Colección "chat_messages": el historial del chat global.
import type { Db } from "mongodb";
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

/** Los últimos `limit` mensajes, del más viejo al más nuevo */
export async function lastMessages(db: Db, limit: number): Promise<ChatMessage[]> {
  const newest = await messages(db).find().sort({ _id: -1 }).limit(limit).toArray();
  return newest.reverse().map(toChatMessage);
}
