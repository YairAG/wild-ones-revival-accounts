// Conexión a MongoDB: la misma base que usa el servidor de juego.
import { MongoClient, type Db } from "mongodb";

// "Ana" y "ana" cuentan como el mismo nombre
export const ignoreCase = { locale: "en", strength: 2 };

export async function connectMongo(url: string): Promise<{ client: MongoClient; db: Db }> {
  const client = await MongoClient.connect(url);
  const db = client.db();
  await createIndexes(db);
  return { client, db };
}

async function createIndexes(db: Db): Promise<void> {
  await db
    .collection("accounts")
    .createIndex({ dname: 1 }, { unique: true, collation: ignoreCase });
  await db.collection("users").createIndex({ id: 1 }, { unique: true });
  await db.collection("users").createIndex({ dname: 1 }, { unique: true });
}
