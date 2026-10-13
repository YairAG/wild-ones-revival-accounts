// Colección "friendships": solicitudes y amistades.
import type { Db } from "mongodb";
import type { Friendship } from "./types";

const friendships = (db: Db) => db.collection<Friendship>("friendships");

// La misma clave para (a, b) y (b, a)
const pairOf = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** La relación entre dos jugadores, en cualquier sentido */
export function findBetween(db: Db, a: number, b: number): Promise<Friendship | null> {
  return friendships(db).findOne({ pair: pairOf(a, b) });
}

/** Todas las relaciones de un jugador (enviadas, recibidas y amistades) */
export function listFor(db: Db, userId: number): Promise<Friendship[]> {
  return friendships(db)
    .find({ $or: [{ from: userId }, { to: userId }] })
    .toArray();
}

/** Crea una solicitud. Devuelve false si ya había una relación entre los dos */
export async function createRequest(db: Db, from: number, to: number): Promise<boolean> {
  try {
    await friendships(db).insertOne({
      pair: pairOf(from, to),
      from,
      to,
      status: "pending",
      createdAt: new Date(),
    });
    return true;
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return false; // índice único de pair
    throw e;
  }
}

/** Acepta la solicitud que `from` le envió a `to`. Devuelve false si no existe */
export async function acceptRequest(db: Db, from: number, to: number): Promise<boolean> {
  const result = await friendships(db).updateOne(
    { from, to, status: "pending" },
    { $set: { status: "accepted" } },
  );
  return result.modifiedCount === 1;
}

/** Borra cualquier relación entre dos jugadores (amistad o solicitud), p. ej. al bloquear */
export async function removeAnyBetween(db: Db, a: number, b: number): Promise<void> {
  await friendships(db).deleteOne({ pair: pairOf(a, b) });
}

/** Borra la relación entre dos jugadores si tiene ese estado. Devuelve false si no había */
export async function removeBetween(
  db: Db,
  a: number,
  b: number,
  status: Friendship["status"],
): Promise<boolean> {
  const result = await friendships(db).deleteOne({ pair: pairOf(a, b), status });
  return result.deletedCount === 1;
}
