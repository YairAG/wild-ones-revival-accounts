// Validación de lo que manda el cliente por el WebSocket del chat.
import { z } from "zod";

export const MAX_LENGTH = 200;

const text = z
  .string()
  .trim()
  .min(1, "Escribe un mensaje")
  .max(MAX_LENGTH, `Máximo ${MAX_LENGTH} caracteres`);

export const clientMessageSchema = z.discriminatedUnion("type", [
  // Primer mensaje: el token del login
  z.object({ type: z.literal("auth"), token: z.string() }),
  z.object({ type: z.literal("send"), text }), // al chat global
  z.object({ type: z.literal("dm"), to: z.number().int().positive(), text }), // privado al jugador `to`
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
    reason: z.string().trim().max(100, "Motivo de 100 caracteres como máximo").optional(),
  }),
]);
