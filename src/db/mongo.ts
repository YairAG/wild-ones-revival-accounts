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
  await db.collection("accounts").createIndex({ userId: 1 }, { unique: true }); // el chat busca por id
  await db.collection("users").createIndex({ id: 1 }, { unique: true });
  await db.collection("users").createIndex({ dname: 1 }, { unique: true });
  // Sesiones (refresh tokens): se buscan por hash y Mongo borra solas las vencidas (índice TTL)
  await db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection("sessions").createIndex({ previousHash: 1 });
  await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  // Bloqueos: uno por pareja y sentido
  await db.collection("blocks").createIndex({ from: 1, to: 1 }, { unique: true });
  // Amigos: una relación por pareja, y búsqueda por quien envía o recibe
  await db.collection("friendships").createIndex({ pair: 1 }, { unique: true });
  await db.collection("friendships").createIndex({ from: 1 });
  await db.collection("friendships").createIndex({ to: 1 });
}
