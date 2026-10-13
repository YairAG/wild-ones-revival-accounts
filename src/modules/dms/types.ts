import type { ObjectId } from "mongodb";
import type { PlayerRef } from "../chat/types";

/** Mensaje privado guardado (colección "direct_messages"). Se guardan sin fecha de borrado */
export type StoredDm = {
  _id?: ObjectId;
  pair: string; // "menor-mayor" de los dos ids: la conversación
  from: PlayerRef;
  to: PlayerRef;
  text: string; // ya filtrado
  original?: string; // lo que escribió, si el filtro lo cambió (solo para un reporte)
  read: boolean; // si quien lo recibió ya lo vio
  createdAt: Date;
};

/** Mensaje privado como lo recibe el frontend */
export type DirectMessage = {
  id: string;
  from: PlayerRef;
  to: PlayerRef;
  text: string;
  at: string; // ISO
};

/** Una conversación en la lista de privados */
export type Conversation = {
  with: PlayerRef;
  last: { text: string; at: string; fromMe: boolean };
  unread: number; // mensajes suyos que no has visto
};

/** Quién puede escribirte en privado (ajuste de la cuenta) */
export type DmPolicy = "friends" | "everyone" | "nobody";
