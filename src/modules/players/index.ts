// Módulo players: el jugador del juego. Rutas (con sesión):
//   GET /players/:id   su perfil: nivel, estadísticas, mascotas, amigos en común y tu relación con él
import type { FastifyInstance } from "fastify";
import type { Db } from "mongodb";
import { AppError } from "../../shared/errors";
import type { ModuleDeps } from "../../shared/module";
import { respond } from "../../shared/response";
import { parseBody } from "../../shared/validation";
import { requireUser } from "../auth/require-user";
import { hasBlocked } from "../blocks/blocks";
import { findBetween, listFor } from "../friends/friendships";
import { playerIdSchema } from "../friends/schemas";
import { findPlayer } from "./players";
import type { PlayerProfile, Relation } from "./types";

// Ids de los amigos (amistades aceptadas) de un jugador
async function friendIds(db: Db, id: number): Promise<Set<number>> {
  const relations = await listFor(db, id);
  return new Set(
    relations.filter((r) => r.status === "accepted").map((r) => (r.from === id ? r.to : r.from)),
  );
}

async function relationWith(db: Db, me: number, id: number): Promise<Relation> {
  if (me === id) return "self";
  const relation = await findBetween(db, me, id);
  if (!relation) return "none";
  if (relation.status === "accepted") return "friends";
  return relation.from === me ? "outgoing" : "incoming";
}

export function playersModule(app: FastifyInstance, { db, config }: ModuleDeps): void {
  app.get("/players/:id", async (req, reply) => {
    const me = requireUser(req, config);
    const { id } = parseBody(playerIdSchema, req.params);
    const player = await findPlayer(db, id);
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND", "Ese jugador no existe");

    const [mine, theirs] = await Promise.all([friendIds(db, me), friendIds(db, id)]);
    const profile: PlayerProfile = {
      id: player.id,
      dname: player.dname,
      level: player.level,
      wins: player.wins,
      losses: player.losses,
      gamecount: player.gamecount,
      presence: player.presence ?? "offline",
      pets: Object.values(player.ownedPets ?? {}).map(({ name, type }) => ({ name, type })),
      mutualFriends: [...mine].filter((f) => theirs.has(f)).length,
      relation: await relationWith(db, me, id),
      blocked: await hasBlocked(db, me, id),
    };
    return respond(reply, 200, `Perfil de ${player.dname}`, profile);
  });
}
