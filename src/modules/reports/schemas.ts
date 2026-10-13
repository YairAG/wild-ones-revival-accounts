// Validación de lo que llega a las rutas de reportes.
import { z } from "zod";
import { REPORT_REASONS } from "./types";

// Body de POST /reports
export const reportSchema = z.object({
  targetId: z.number().int().positive("Jugador no válido"),
  reason: z.enum(REPORT_REASONS, "Elige un motivo"),
  details: z.string().trim().max(300, "Detalles de 300 caracteres como máximo").optional(),
  messageId: z.string().optional(), // mensaje del chat del reportado
});

// El :id de la URL
export const reportIdSchema = z.object({ id: z.string() });
