// Lee el .env y lo valida al arrancar: si falta algo obligatorio, el backend no arranca.
import { z } from "zod";

export type Config = {
  port: number;
  mongoUrl: string;
  jwtSecret: string; // el mismo JWT_SECRET que el servidor de juego
  jwtExpiresIn: string; // token de acceso (JWT), p. ej. "15m": corto, se renueva con el refresh token
  refreshTokenDays: number; // cuánto dura la sesión (la cookie httpOnly con el refresh token)
  cookieSecure: boolean; // cookie solo por HTTPS: true en producción
  corsOrigin: string; // URL del frontend
  requestsPerMinute: number; // límite de intentos por IP
};

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  MONGO_URL: z.string().min(1, "Falta MONGO_URL en el .env"),
  JWT_SECRET: z.string().min(1, "Falta JWT_SECRET en el .env"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z.stringbool().default(false),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  REQUESTS_PER_MINUTE: z.coerce.number().default(10),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const e = envSchema.parse(env);
  return {
    port: e.PORT,
    mongoUrl: e.MONGO_URL,
    jwtSecret: e.JWT_SECRET,
    jwtExpiresIn: e.JWT_EXPIRES_IN,
    refreshTokenDays: e.REFRESH_TOKEN_DAYS,
    cookieSecure: e.COOKIE_SECURE,
    corsOrigin: e.CORS_ORIGIN,
    requestsPerMinute: e.REQUESTS_PER_MINUTE,
  };
}
