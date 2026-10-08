// MongoDB: la misma base que usa el servidor de juego.
// - accounts: credenciales (solo este backend las lee)
// - users: datos del jugador (los lee y escribe el servidor de juego)
// - counters: contador para ids numéricos consecutivos
import { MongoClient, type Db } from "mongodb";

export type Account = { userId: number; dname: string; passwordHash: string; createdAt: Date };

// "Ana" y "ana" cuentan como el mismo nombre
export const sameNameIgnoringCase = { locale: "en", strength: 2 };

export async function connectDb(url: string): Promise<{ client: MongoClient; db: Db }> {
  const client = await MongoClient.connect(url);
  const db = client.db();
  await db.collection("accounts").createIndex({ dname: 1 }, { unique: true, collation: sameNameIgnoringCase });
  await db.collection("users").createIndex({ id: 1 }, { unique: true });
  await db.collection("users").createIndex({ dname: 1 }, { unique: true });
  return { client, db };
}

// 1, 2, 3... sin repetirse aunque se registren dos a la vez
export async function nextUserId(db: Db): Promise<number> {
  const counter = await db
    .collection<{ _id: string; seq: number }>("counters")
    .findOneAndUpdate({ _id: "userId" }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  return counter!.seq;
}
