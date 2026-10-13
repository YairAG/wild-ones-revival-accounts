import type { ObjectId } from "mongodb";
import type { Failure, Success } from "../../shared/response";

/** Mensaje guardado (colección "chat_messages") */
export type StoredMessage = {
  _id?: ObjectId;
  userId: number;
  dname: string;
  text: string; // ya filtrado
  original?: string; // lo que escribió, solo si el filtro lo cambió
  createdAt: Date;
};

/** Mensaje como lo recibe el frontend */
export type ChatMessage = {
  id: string; // _id de Mongo en texto
  userId: number;
  dname: string;
  text: string;
  original?: string; // solo para moderadores, si el filtro cambió el texto
  at: string; // fecha ISO
};

/** Un jugador, por id y nombre */
export type PlayerRef = { id: number; dname: string };

/** Acción de un moderador (colección "moderation_log") */
export type LoggedAction = {
  at: Date;
  mod: PlayerRef; // quién la hizo
  action: "delete" | "mute" | "unmute";
  target: PlayerRef; // a quién (el autor del mensaje borrado, el silenciado...)
  text?: string; // el mensaje borrado (el original si el filtro lo había cambiado)
  minutes?: number; // duración del silencio
  reason?: string; // motivo del silencio
};

/** Una acción en el panel de moderación (como LoggedAction, con la fecha en ISO) */
export type ModerationLogEntry = Omit<LoggedAction, "at"> & { at: string };

/** Respuesta de GET /chat/moderation */
export type ModerationSummary = {
  muted: (PlayerRef & { until: string })[]; // silenciados ahora
  log: ModerationLogEntry[]; // las últimas acciones, la más nueva primero
};

/** Lo que el servidor manda por el WebSocket */
export type ChatServerEvent =
  // Al entrar: los últimos mensajes, del más viejo al más nuevo, y si puedes moderar
  | { type: "history"; messages: ChatMessage[]; mod: boolean }
  | { type: "message"; message: ChatMessage } // alguien escribió
  | { type: "deleted"; id: string } // un moderador borró un mensaje
  // Avisos y errores solo para ti, con el formato de todas las respuestas (shared/response.ts)
  | ({ type: "notice" } & Success) // "Beto silenciado 1 h"
  | ({ type: "error" } & Failure); // "Espera un momento antes de mandar otro mensaje"
