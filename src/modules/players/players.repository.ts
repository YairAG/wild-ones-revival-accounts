// Acceso a la colección "users" (jugadores). Este backend solo los crea; el resto lo hace el servidor de juego.
import type { Db } from "mongodb";
import type { Player } from "../../types";

export function createPlayersRepository(db: Db) {
  const users = db.collection<Player>("users");

  return {
    async create(player: Player): Promise<void> {
      await users.insertOne(player);
    },
  };
}

export type PlayersRepository = ReturnType<typeof createPlayersRepository>;
