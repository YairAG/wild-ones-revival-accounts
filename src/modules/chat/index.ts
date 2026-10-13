// Módulo chat: chat global en tiempo real por WebSocket (GET /chat).
// El cliente primero manda { type: "auth", token } con el token del login (en un mensaje y no en la URL, para
// que no quede en los logs). Al entrar recibe el historial y desde ahí puede escribir. Los moderadores
// (role "mod" en accounts) además pueden borrar mensajes y silenciar jugadores; cada acción queda en el
// registro que muestra el panel de moderación (moderation.ts). Los privados ({ type: "dm" }) también van por
// aquí; las rutas para leerlos están en el módulo dms.
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import type { ModuleDeps } from "../../shared/module";
import { failure, success, type ErrorId } from "../../shared/response";
import { findAccountById, muteAccount } from "../auth/accounts";
import { verifyToken } from "../auth/token";
import { pairOf, saveDm, toDirectMessage } from "../dms/direct-messages";
import { dmRefusal } from "../dms/policy";
import { filterText } from "./filter";
import { deleteMessage, lastMessages, saveMessage, toChatMessage } from "./messages";
import { moderationRoutes } from "./moderation";
import { logAction } from "./moderation-log";
import { clientMessageSchema } from "./schemas";
import type { ChatServerEvent } from "./types";

const HISTORY_SIZE = 50;
const MIN_INTERVAL_MS = 2_000; // un mensaje cada 2 s por jugador

// "5 min", "1 h", "1 día", "7 días"
const duration = (minutes: number) =>
  minutes < 60
    ? `${minutes} min`
    : minutes < 24 * 60
      ? `${Math.round(minutes / 60)} h`
      : `${Math.round(minutes / (24 * 60))} ${minutes < 2 * 24 * 60 ? "día" : "días"}`;

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export function chatModule(app: FastifyInstance, { db, config }: ModuleDeps): void {
  // Conexiones que ya entraron → de quién son y si es moderador
  const online = new Map<WebSocket, { id: number; mod: boolean }>();
  const lastSent = new Map<number, number>(); // id del jugador → cuándo escribió por última vez
  moderationRoutes(app, { db, config });

  const send = (socket: WebSocket, event: ChatServerEvent) => socket.send(JSON.stringify(event));
  const broadcast = (event: ChatServerEvent) =>
    online.forEach((_user, socket) => send(socket, event));

  app.get("/chat", { websocket: true }, (socket) => {
    let user: { id: number; dname: string; mod: boolean } | null = null;
    const fail = (code: number, error: ErrorId, message: string) =>
      send(socket, { type: "error", ...failure(code, error, message) });

    async function handle(raw: string) {
      const parsed = clientMessageSchema.safeParse(parseJson(raw));
      if (!parsed.success) return fail(400, "INVALID_DATA", parsed.error.issues[0].message);
      const message = parsed.data;

      if (message.type === "auth") {
        const id = verifyToken(config, message.token);
        const account = id === null ? null : await findAccountById(db, id);
        if (!account) {
          fail(401, "SESSION_EXPIRED", "Tu sesión expiró, vuelve a entrar");
          return socket.close();
        }
        user = { id: account.userId, dname: account.dname, mod: account.role === "mod" };
        const messages = await lastMessages(db, HISTORY_SIZE, user.mod);
        send(socket, { type: "history", messages, mod: user.mod });
        online.set(socket, { id: user.id, mod: user.mod });
        return;
      }

      if (!user) return fail(401, "LOGIN_REQUIRED", "Primero entra con tu sesión");

      if (message.type === "delete" || message.type === "mute") {
        if (!user.mod) return fail(403, "NOT_MOD", "Solo los moderadores pueden hacer eso");
        const mod = { id: user.id, dname: user.dname };
        if (message.type === "delete") {
          const deleted = await deleteMessage(db, message.id);
          if (!deleted) return fail(404, "MESSAGE_NOT_FOUND", "Ese mensaje ya no existe");
          broadcast({ type: "deleted", id: message.id });
          const target = { id: deleted.userId, dname: deleted.dname };
          const text = deleted.original ?? deleted.text;
          return logAction(db, { at: new Date(), mod, action: "delete", target, text });
        }
        const { userId, minutes, reason } = message;
        const muted = await muteAccount(db, userId, new Date(Date.now() + minutes * 60_000));
        if (!muted) return fail(404, "PLAYER_NOT_FOUND", "No existe ese jugador");
        const target = { id: muted.userId, dname: muted.dname };
        await logAction(db, { at: new Date(), mod, action: "mute", target, minutes, reason });
        const notice = success(200, `${muted.dname} silenciado ${duration(minutes)}`);
        return send(socket, { type: "notice", ...notice });
      }

      // Se lee la cuenta en cada mensaje para que un silencio aplique aunque ya estuviera conectado
      const mutedUntil = (await findAccountById(db, user.id))?.mutedUntil;
      const now = Date.now();
      if (mutedUntil && mutedUntil.getTime() > now) {
        const minutes = Math.ceil((mutedUntil.getTime() - now) / 60_000);
        return fail(403, "MUTED", `Estás silenciado ${minutes} min más`);
      }
      if (now - (lastSent.get(user.id) ?? 0) < MIN_INTERVAL_MS) {
        return fail(429, "TOO_FAST", "Espera un momento antes de mandar otro mensaje");
      }
      lastSent.set(user.id, now);

      const text = filterText(message.text);
      const original = text !== message.text ? { original: message.text } : {};

      if (message.type === "dm") {
        const to = await findAccountById(db, message.to);
        if (!to) return fail(404, "PLAYER_NOT_FOUND", "No existe ese jugador");
        const refusal = await dmRefusal(db, user.id, to);
        if (refusal) return fail(...refusal);
        const dm = await saveDm(db, {
          pair: pairOf(user.id, to.userId),
          from: { id: user.id, dname: user.dname },
          to: { id: to.userId, dname: to.dname },
          text,
          ...original,
          read: false,
          createdAt: new Date(now),
        });
        // A todas las pestañas de los dos
        const event: ChatServerEvent = { type: "dm", message: toDirectMessage(dm) };
        online.forEach(({ id }, s) => [user!.id, to.userId].includes(id) && send(s, event));
        return;
      }

      const saved = await saveMessage(db, {
        userId: user.id,
        dname: user.dname,
        text,
        ...original,
        createdAt: new Date(now),
      });
      // A cada quien con lo suyo: los moderadores también reciben el original
      online.forEach(({ mod }, s) =>
        send(s, { type: "message", message: toChatMessage(saved, mod) }),
      );
    }

    socket.on("message", (raw) =>
      handle(String(raw)).catch((e) => {
        app.log.error(e);
        fail(500, "SERVER_ERROR", "Error inesperado, intenta de nuevo");
      }),
    );
    socket.on("close", () => online.delete(socket));
  });
}
