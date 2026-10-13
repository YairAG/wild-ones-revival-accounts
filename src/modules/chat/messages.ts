// Colección "chat_messages": el historial del chat global.
import { ObjectId, type Db } from "mongodb";
import type { ChatMessage, StoredMessage } from "./types";

const messages = (db: Db) => db.collection<StoredMessage>("chat_messages");

/** El mensaje como lo ve el frontend. El texto original (sin filtrar) solo va a los moderadores */
export function toChatMessage(stored: StoredMessage, forMod: boolean): ChatMessage {
  const { _id, userId, dname, text, original, createdAt } = stored;
  const message: ChatMessage = {
    id: String(_id),
    userId,
    dname,
    text,
    at: createdAt.toISOString(),
  };
  if (forMod && original) message.original = original;
  return message;
}

/** Guarda el mensaje y lo devuelve con su _id */
export async function saveMessage(db: Db, message: StoredMessage): Promise<StoredMessage> {
  const { insertedId } = await messages(db).insertOne(message);
  return { ...message, _id: insertedId };
}

/** Borra un mensaje por su id. Devuelve false si no existe */
export async function deleteMessage(db: Db, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const { deletedCount } = await messages(db).deleteOne({ _id: new ObjectId(id) });
  return deletedCount === 1;
}

/** Los últimos `limit` mensajes, del más viejo al más nuevo */
export async function lastMessages(db: Db, limit: number, forMod: boolean): Promise<ChatMessage[]> {
  const newest = await messages(db).find().sort({ _id: -1 }).limit(limit).toArray();
  return newest.reverse().map((m) => toChatMessage(m, forMod));
}
