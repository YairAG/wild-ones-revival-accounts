import type { Presence } from "../players/types";

/**
 * Relación entre dos jugadores (colección "friendships"): una solicitud pendiente o una amistad.
 * Un solo documento por pareja: `pair` ("menor-mayor" de los dos ids) tiene índice único.
 */
export type Friendship = {
  pair: string;
  from: number; // quien envió la solicitud
  to: number;
  status: "pending" | "accepted";
  createdAt: Date;
};

/** Un amigo, como lo ve el frontend */
export type Friend = { id: number; dname: string; level: number; presence: Presence };

/** Un jugador en una solicitud */
export type PlayerRef = { id: number; dname: string };

/** Respuesta de GET /friends */
export type FriendsList = {
  friends: Friend[];
  incoming: PlayerRef[]; // solicitudes que te enviaron
  outgoing: PlayerRef[]; // solicitudes que enviaste
};
