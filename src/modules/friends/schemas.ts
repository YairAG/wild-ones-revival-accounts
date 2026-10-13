// Validación de lo que llega a las rutas de amigos.
import { z } from "zod";

// Body de POST /friends/requests
export const friendRequestSchema = z.object({
  dname: z.string().min(1, "Escribe el nombre del jugador").max(16),
});

// El :id de la URL
export const playerIdSchema = z.object({
  id: z.coerce.number().int().positive("Jugador no válido"),
});
