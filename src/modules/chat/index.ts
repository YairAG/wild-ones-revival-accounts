// Módulo chat: chat global en tiempo real por WebSocket (GET /chat).
// El cliente primero manda { type: "auth", token } con el token del login (en un mensaje y no en la URL, para
// que no quede en los logs). Al entrar recibe el historial y desde ahí puede escribir. Los moderadores
// (role "mod" en accounts) además pueden borrar mensajes y silenciar jugadores.
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import type { ModuleDeps } from "../../shared/module";
import { findAccountById, muteAccount } from "../auth/accounts";
import { verifyToken } from "../auth/token";
import { filterText } from "./filter";
import { deleteMessage, lastMessages, saveMessage, toChatMessage } from "./messages";
import { clientMessageSchema } from "./schemas";
import type { ChatServerEvent } from "./types";

const HISTORY_SIZE = 50;
const MIN_INTERVAL_MS = 2_000; // un mensaje cada 2 s por jugador

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export function chatModule(app: FastifyInstance, { db, config }: ModuleDeps): void {
  const online = new Map<WebSocket, boolean>(); // conexiones que ya entraron → si es moderador
  const lastSent = new Map<number, number>(); // id del jugador → cuándo escribió por última vez

  const send = (socket: WebSocket, event: ChatServerEvent) => socket.send(JSON.stringify(event));
  const broadcast = (event: ChatServerEvent) =>
    online.forEach((_mod, socket) => send(socket, event));

  app.get("/chat", { websocket: true }, (socket) => {
    let user: { id: number; dname: string; mod: boolean } | null = null;
    const fail = (error: string) => send(socket, { type: "error", error });

    async function handle(raw: string) {
      const parsed = clientMessageSchema.safeParse(parseJson(raw));
      if (!parsed.success) return fail(parsed.error.issues[0].message);
      const message = parsed.data;

      if (message.type === "auth") {
        const id = verifyToken(config, message.token);
        const account = id === null ? null : await findAccountById(db, id);
        if (!account) {
          fail("Tu sesión expiró, vuelve a entrar");
          return socket.close();
        }
        user = { id: account.userId, dname: account.dname, mod: account.role === "mod" };
        const messages = await lastMessages(db, HISTORY_SIZE, user.mod);
        send(socket, { type: "history", messages, mod: user.mod });
        online.set(socket, user.mod);
        return;
      }

      if (!user) return fail("Primero entra con tu sesión");

      if (message.type === "delete" || message.type === "mute") {
        if (!user.mod) return fail("Solo los moderadores pueden hacer eso");
        if (message.type === "delete") {
          if (!(await deleteMessage(db, message.id))) return fail("Ese mensaje ya no existe");
          return broadcast({ type: "deleted", id: message.id });
        }
        const until = new Date(Date.now() + message.minutes * 60_000);
        if (!(await muteAccount(db, message.userId, until))) return fail("No existe ese jugador");
        return send(socket, { type: "notice", text: `Silenciado ${message.minutes} min` });
      }

      // Se lee la cuenta en cada mensaje para que un silencio aplique aunque ya estuviera conectado
      const mutedUntil = (await findAccountById(db, user.id))?.mutedUntil;
      const now = Date.now();
      if (mutedUntil && mutedUntil.getTime() > now) {
        const minutes = Math.ceil((mutedUntil.getTime() - now) / 60_000);
        return fail(`Estás silenciado ${minutes} min más`);
      }
      if (now - (lastSent.get(user.id) ?? 0) < MIN_INTERVAL_MS) {
        return fail("Espera un momento antes de mandar otro mensaje");
      }
      lastSent.set(user.id, now);

      const text = filterText(message.text);
      const saved = await saveMessage(db, {
        userId: user.id,
        dname: user.dname,
        text,
        ...(text !== message.text && { original: message.text }),
        createdAt: new Date(now),
      });
      // A cada quien con lo suyo: los moderadores también reciben el original
      online.forEach((mod, s) => send(s, { type: "message", message: toChatMessage(saved, mod) }));
    }

    socket.on("message", (raw) =>
      handle(String(raw)).catch((e) => {
        app.log.error(e);
        fail("Error inesperado");
      }),
    );
    socket.on("close", () => online.delete(socket));
  });
}
