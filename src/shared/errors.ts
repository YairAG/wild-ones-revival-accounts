import type { ErrorId } from "./response";

/** Error esperado: código HTTP, identificador fijo y mensaje para el jugador. app.ts lo convierte en
 * { ok: false, code, message, error } (ver response.ts) */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly error: ErrorId,
    message: string,
  ) {
    super(message);
  }
}
