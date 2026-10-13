// GET /friends: tus amigos (con nivel y dónde están), las solicitudes pendientes (enviadas y recibidas) y a quién
// bloqueaste.
import type { FastifyInstance } from "fastify";
import type { ModuleDeps } from "../../shared/module";
import { respond } from "../../shared/response";
import { requireUser } from "../auth/require-user";
import { blockedBy } from "../blocks/blocks";
import { findPlayers } from "../players/players";
import { listFor } from "./friendships";
import type { Friend, FriendsList, PlayerRef } from "./types";

// En línea primero (en partida, luego en lobby), después por nombre
const presenceOrder = { playing: 0, lobby: 1, offline: 2 };

export function listRoute(app: FastifyInstance, { db, config }: ModuleDeps): void {
  app.get("/friends", async (req, reply) => {
    const me = requireUser(req, config);
    const relations = await listFor(db, me);
    const other = (r: { from: number; to: number }) => (r.from === me ? r.to : r.from);

    const blockedIds = await blockedBy(db, me);
    const ids = [...relations.map(other), ...blockedIds];
    const players = new Map((await findPlayers(db, ids)).map((p) => [p.id, p]));
    const result: FriendsList = { friends: [], incoming: [], outgoing: [], blocked: [] };
    for (const id of blockedIds) {
      const player = players.get(id);
      if (player) result.blocked.push({ id, dname: player.dname });
    }

    for (const relation of relations) {
      const player = players.get(other(relation));
      if (!player) continue; // el jugador ya no existe
      if (relation.status === "accepted") {
        const friend: Friend = {
          id: player.id,
          dname: player.dname,
          level: player.level,
          presence: player.presence ?? "offline",
        };
        result.friends.push(friend);
      } else {
        const ref: PlayerRef = { id: player.id, dname: player.dname };
        (relation.to === me ? result.incoming : result.outgoing).push(ref);
      }
    }

    result.friends.sort(
      (a, b) =>
        presenceOrder[a.presence] - presenceOrder[b.presence] || a.dname.localeCompare(b.dname),
    );
    return respond(reply, 200, "Lista de amigos", result);
  });
}
