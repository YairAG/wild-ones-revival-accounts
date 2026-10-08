// Lee el .env y lo valida al arrancar: si falta algo obligatorio, el backend no arranca.
import { z } from "zod";
import type { Config } from "../types";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  MONGO_URL: z.string().min(1, "Falta MONGO_URL en el .env"),
  JWT_SECRET: z.string().min(1, "Falta JWT_SECRET en el .env"),
  JWT_EXPIRES_IN: z.string().default("10m"),
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
    corsOrigin: e.CORS_ORIGIN,
    requestsPerMinute: e.REQUESTS_PER_MINUTE,
  };
}
