// Formato de todas las respuestas de este backend (rutas HTTP y avisos del WebSocket del chat):
//   bien:  { ok: true,  code: 200, message: "Solicitud enviada", data: {...} }   (data solo si hay algo que devolver)
//   error: { ok: false, code: 409, message: "Ese nombre ya existe", error: "NAME_TAKEN" }
// `message` es para mostrarle al jugador; `error` es fijo (no cambia si se reescribe el mensaje) y es lo que
// revisa el frontend para decidir qué hacer.
import type { FastifyReply } from "fastify";

/** Identificadores de error. El código HTTP con el que suele ir cada uno está al lado */
export type ErrorId =
  | "INVALID_DATA" // 400: el body, los parámetros o el mensaje no son válidos
  | "SELF_REQUEST" // 400: solicitud de amistad a ti mismo
  | "SELF_BLOCK" // 400
  | "SELF_REPORT" // 400
  | "WRONG_CREDENTIALS" // 401: nombre o contraseña incorrectos
  | "SESSION_EXPIRED" // 401: sin token o token vencido
  | "LOGIN_REQUIRED" // 401: en el chat, escribir antes de mandar el token
  | "NOT_MOD" // 403: solo moderadores
  | "MUTED" // 403: silenciado en el chat
  | "WRONG_PASSWORD" // 403: la contraseña que confirmó no es la suya
  | "BLOCKED" // 403: uno de los dos bloqueó al otro
  | "NOT_FOUND" // 404: la ruta no existe
  | "PLAYER_NOT_FOUND" // 404
  | "REQUEST_NOT_FOUND" // 404: solicitud de amistad
  | "NOT_FRIENDS" // 404
  | "NOT_MUTED" // 404
  | "NOT_BLOCKED" // 404
  | "REPORT_NOT_FOUND" // 404
  | "MESSAGE_NOT_FOUND" // 404: mensaje del chat
  | "NAME_TAKEN" // 409
  | "ALREADY_FRIENDS" // 409
  | "ALREADY_REQUESTED" // 409: ya hay una solicitud entre los dos
  | "ALREADY_REPORTED" // 409: ya tienes un reporte abierto de ese jugador
  | "TOO_MANY_REQUESTS" // 429: límite de intentos de login/registro
  | "TOO_FAST" // 429: en el chat, un mensaje cada 2 s
  | "SERVER_ERROR"; // 500

export type Success<T = unknown> = { ok: true; code: number; message: string; data?: T };
export type Failure = { ok: false; code: number; message: string; error: ErrorId };

export const success = <T>(code: number, message: string, data?: T): Success<T> => ({
  ok: true,
  code,
  message,
  ...(data !== undefined && { data }),
});

export const failure = (code: number, error: ErrorId, message: string): Failure => ({
  ok: false,
  code,
  message,
  error,
});

/** Responde una ruta HTTP con éxito: el código va en la respuesta y en el body */
export const respond = <T>(res: FastifyReply, code: number, message: string, data?: T) =>
  res.code(code).send(success(code, message, data));
