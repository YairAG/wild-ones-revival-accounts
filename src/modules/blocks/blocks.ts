// Colección "blocks": a quién bloqueó cada jugador.
import type { Db } from "mongodb";
import type { Block } from "./types";

const blocks = (db: Db) => db.collection<Block>("blocks");

/** Bloquea (si ya estaba bloqueado, no cambia nada) */
export async function addBlock(db: Db, from: number, to: number): Promise<void> {
  await blocks(db).updateOne(
    { from, to },
    { $setOnInsert: { from, to, createdAt: new Date() } },
    { upsert: true },
  );
}

/** Desbloquea. Devuelve false si no estaba bloqueado */
export async function removeBlock(db: Db, from: number, to: number): Promise<boolean> {
  return (await blocks(db).deleteOne({ from, to })).deletedCount === 1;
}

/** ¿`from` bloqueó a `to`? */
export async function hasBlocked(db: Db, from: number, to: number): Promise<boolean> {
  return (await blocks(db).findOne({ from, to })) !== null;
}

/** ¿Alguno de los dos bloqueó al otro? */
export async function blockedEitherWay(db: Db, a: number, b: number): Promise<boolean> {
  const block = await blocks(db).findOne({
    $or: [
      { from: a, to: b },
      { from: b, to: a },
    ],
  });
  return block !== null;
}

/** Ids de los jugadores que bloqueó `from` */
export async function blockedBy(db: Db, from: number): Promise<number[]> {
  return (await blocks(db).find({ from }).toArray()).map((b) => b.to);
}

/** Borra los bloqueos que hizo y los que le hicieron (al eliminar su cuenta) */
export async function removeAllBlocksFor(db: Db, userId: number): Promise<void> {
  await blocks(db).deleteMany({ $or: [{ from: userId }, { to: userId }] });
}
