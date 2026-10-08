/** Configuración del backend (sale del .env, ver config/env.ts) */
export type Config = {
  port: number;
  mongoUrl: string;
  jwtSecret: string; // el mismo JWT_SECRET que el servidor de juego
  jwtExpiresIn: string; // p. ej. "10m": el token solo se usa al hacer logIn
  corsOrigin: string; // URL del frontend
  requestsPerMinute: number; // límite de intentos por IP
};
