// Módulo chat: chat global en tiempo real por WebSocket (GET /chat).
// El cliente primero manda { type: "auth", token } con el token del login (en un mensaje y no en la URL, para
// que no quede en los logs). Al entrar recibe el historial y desde ahí puede escribir.
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import type { ModuleDeps } from "../../shared/module";
import { findAccountById } from "../auth/accounts";
import { verifyToken } from "../auth/token";
import { filterText } from "./filter";
import { lastMessages, saveMessage } from "./messages";
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
  const online = new Set<WebSocket>(); // conexiones que ya entraron
  const lastSent = new Map<number, number>(); // id del jugador → cuándo escribió por última vez

  const send = (socket: WebSocket, event: ChatServerEvent) => socket.send(JSON.stringify(event));
  const broadcast = (event: ChatServerEvent) => online.forEach((socket) => send(socket, event));

  app.get("/chat", { websocket: true }, (socket) => {
    let user: { id: number; dname: string } | null = null;
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
        user = { id: account.userId, dname: account.dname };
        send(socket, { type: "history", messages: await lastMessages(db, HISTORY_SIZE) });
        online.add(socket);
        return;
      }

      if (!user) return fail("Primero entra con tu sesión");
      const now = Date.now();
      if (now - (lastSent.get(user.id) ?? 0) < MIN_INTERVAL_MS) {
        return fail("Espera un momento antes de mandar otro mensaje");
      }
      lastSent.set(user.id, now);

      const saved = await saveMessage(db, {
        userId: user.id,
        dname: user.dname,
        text: filterText(message.text),
        createdAt: new Date(now),
      });
      broadcast({ type: "message", message: saved });
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
