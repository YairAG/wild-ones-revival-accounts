// Colección "direct_messages": los mensajes privados entre dos jugadores.
import { ObjectId, type Db } from "mongodb";
import type { Conversation, DirectMessage, StoredDm } from "./types";

const dms = (db: Db) => db.collection<StoredDm>("direct_messages");

// La misma clave para (a, b) y (b, a)
export const pairOf = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export const toDirectMessage = ({ _id, from, to, text, createdAt }: StoredDm): DirectMessage => ({
  id: String(_id),
  from,
  to,
  text,
  at: createdAt.toISOString(),
});

export async function saveDm(db: Db, dm: StoredDm): Promise<StoredDm> {
  const { insertedId } = await dms(db).insertOne(dm);
  return { ...dm, _id: insertedId };
}

/** Los últimos `limit` mensajes entre dos jugadores, del más viejo al más nuevo */
export async function lastDms(
  db: Db,
  a: number,
  b: number,
  limit: number,
): Promise<DirectMessage[]> {
  const newest = await dms(db)
    .find({ pair: pairOf(a, b) })
    .sort({ _id: -1 })
    .limit(limit)
    .toArray();
  return newest.reverse().map(toDirectMessage);
}

/** Marca como leídos los mensajes que `from` le mandó a `to` */
export async function markRead(db: Db, from: number, to: number): Promise<void> {
  await dms(db).updateMany({ "from.id": from, "to.id": to, read: false }, { $set: { read: true } });
}

/** Las conversaciones de un jugador, la más reciente primero */
export async function conversationsOf(db: Db, me: number): Promise<Conversation[]> {
  // Lo más nuevo primero: el primer mensaje que aparece de cada conversación es el último
  const messages = await dms(db)
    .find({ $or: [{ "from.id": me }, { "to.id": me }] })
    .sort({ _id: -1 })
    .limit(2000)
    .toArray();
  const conversations = new Map<number, Conversation>();
  for (const dm of messages) {
    const fromMe = dm.from.id === me;
    const other = fromMe ? dm.to : dm.from;
    let conversation = conversations.get(other.id);
    if (!conversation) {
      conversation = {
        with: other,
        last: { text: dm.text, at: dm.createdAt.toISOString(), fromMe },
        unread: 0,
      };
      conversations.set(other.id, conversation);
    }
    if (!fromMe && !dm.read) conversation.unread++;
  }
  return [...conversations.values()];
}

/** Un mensaje privado que `from` le mandó a `to` (para adjuntarlo a un reporte) */
export function findDmFromTo(db: Db, id: string, from: number, to: number) {
  if (!ObjectId.isValid(id)) return Promise.resolve(null);
  return dms(db).findOne({ _id: new ObjectId(id), "from.id": from, "to.id": to });
}

/** Borra los privados de un jugador (al eliminar su cuenta) */
export async function deleteDmsOf(db: Db, userId: number): Promise<void> {
  await dms(db).deleteMany({ $or: [{ "from.id": userId }, { "to.id": userId }] });
}
