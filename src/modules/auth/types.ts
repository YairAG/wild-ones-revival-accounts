/** Credenciales de un jugador (colección "accounts"). Solo las usa este backend */
export type Account = {
  userId: number;
  dname: string;
  passwordHash: string; // "salt:hash" de scrypt
  createdAt: Date;
  role?: "mod"; // moderador del chat. Se da a mano en Mongo (ver README)
  mutedUntil?: Date; // silenciado en el chat hasta esta fecha
};

/** Lo que devuelven /register, /login y /refresh (el refresh token va aparte, en la cookie httpOnly) */
export type Session = {
  id: number;
  dname: string;
  token: string; // JWT de acceso: para las rutas con sesión, el chat y el servidor de juego. Dura poco
};

/** Sesión iniciada en un navegador (colección "sessions"). Ver sessions.ts */
export type RefreshSession = {
  userId: number;
  tokenHash: string; // sha256 del refresh token vigente
  previousHash?: string; // el de antes de la última rotación (para la gracia entre pestañas)
  rotatedAt?: Date;
  expiresAt: Date; // Mongo borra la sesión al pasar esta fecha (índice TTL)
  createdAt: Date;
};
