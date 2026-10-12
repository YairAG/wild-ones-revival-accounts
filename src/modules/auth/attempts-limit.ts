// Límite de intentos por IP para las rutas que reciben contraseñas (contra fuerza bruta).
// Se pasa como opciones de la ruta: app.post("/login", attemptsLimit(config), ...)
import type { Config } from "../../config/env";

export const attemptsLimit = (config: Config) => ({
  config: { rateLimit: { max: config.requestsPerMinute, timeWindow: "1 minute" } },
});
