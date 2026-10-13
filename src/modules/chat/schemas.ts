// Validación de lo que manda el cliente por el WebSocket del chat.
import { z } from "zod";

export const MAX_LENGTH = 200;

export const clientMessageSchema = z.discriminatedUnion("type", [
  // Primer mensaje: el token del login
  z.object({ type: z.literal("auth"), token: z.string() }),
  z.object({
    type: z.literal("send"),
    text: z
      .string()
      .trim()
      .min(1, "Escribe un mensaje")
      .max(MAX_LENGTH, `Máximo ${MAX_LENGTH} caracteres`),
  }),
  // Solo moderadores
  z.object({ type: z.literal("delete"), id: z.string() }),
  z.object({
    type: z.literal("mute"),
    userId: z.number().int().positive(),
    minutes: z
      .number()
      .int()
      .min(1)
      .max(7 * 24 * 60, "Máximo una semana"),
  }),
]);
