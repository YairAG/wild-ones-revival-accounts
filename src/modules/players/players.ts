// Colección "users": el jugador del juego. Este backend solo lo crea; el resto lo hace el servidor de juego.
import type { Db } from "mongodb";
import type { Player } from "./types";

export async function createPlayer(db: Db, player: Player): Promise<void> {
  await db.collection<Player>("users").insertOne(player);
}
