// Colección "users": el jugador del juego. Este backend lo crea y lo lee; el resto lo hace el servidor de juego.
import type { Db } from "mongodb";
import type { Player } from "./types";

const users = (db: Db) => db.collection<Player>("users");

export async function createPlayer(db: Db, player: Player): Promise<void> {
  await users(db).insertOne(player);
}

/** Un jugador por id (sin los campos internos del juego que no hacen falta) */
export function findPlayer(db: Db, id: number) {
  return users(db).findOne(
    { id },
    {
      projection: {
        _id: 0,
        id: 1,
        dname: 1,
        level: 1,
        wins: 1,
        losses: 1,
        gamecount: 1,
        presence: 1,
        ownedPets: 1,
        currentPet: 1,
      },
    },
  ) as Promise<Pick<
    Player,
    | "id"
    | "dname"
    | "level"
    | "wins"
    | "losses"
    | "gamecount"
    | "presence"
    | "ownedPets"
    | "currentPet"
  > | null>;
}

/** Lo básico de varios jugadores (nombre, nivel, dónde están), por id */
export function findPlayers(db: Db, ids: number[]) {
  return users(db)
    .find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, dname: 1, level: 1, presence: 1 } })
    .toArray() as Promise<Pick<Player, "id" | "dname" | "level" | "presence">[]>;
}

export async function deletePlayer(db: Db, id: number): Promise<void> {
  await users(db).deleteOne({ id });
}
