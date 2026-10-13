import type { ObjectId } from "mongodb";

/** Mensaje guardado (colección "chat_messages") */
export type StoredMessage = {
  _id?: ObjectId;
  userId: number;
  dname: string;
  text: string; // ya filtrado
  createdAt: Date;
};

/** Mensaje como lo recibe el frontend */
export type ChatMessage = {
  id: string; // _id de Mongo en texto
  userId: number;
  dname: string;
  text: string;
  at: string; // fecha ISO
};

/** Lo que el servidor manda por el WebSocket */
export type ChatServerEvent =
  // Al entrar: los últimos mensajes, del más viejo al más nuevo, y si puedes moderar
  | { type: "history"; messages: ChatMessage[]; mod: boolean }
  | { type: "message"; message: ChatMessage } // alguien escribió
  | { type: "deleted"; id: string } // un moderador borró un mensaje
  | { type: "notice"; text: string } // aviso solo para ti ("Beto silenciado 60 min")
  | { type: "error"; error: string }; // solo a quien lo causó
